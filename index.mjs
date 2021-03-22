import dotenv from 'dotenv'
import fetch from 'node-fetch'
import { writeFileSync } from 'fs'

// Load .env files
dotenv.config()

// Environment settings
const api_base = process.env.API_BASE
const wallet_token = process.env.WALLET_TOKEN
const hub_token = process.env.HUB_TOKEN
const keyguard_token = process.env.KEYGUARD_TOKEN

/**
 * @typedef {{
 *      message: string,
 *      name: string,
 *      protected: boolean,,
 *      release: string | null,
 *      target: string,
 *      commit: {
 *          author_email: string,
 *          author_name: string,
 *          authored_date: string,
 *          committed_date: string,
 *          committer_email: string,
 *          committer_name: string,
 *          created_at: string,
 *          id: string,
 *          message: string,
 *          parent_ids: string[],
 *          short_id: string,
 *          title: string,
 *          web_url: string,
 *      },
 * }} Tag
 */

/**
 * @typedef {{
 *      app: 'Wallet' | 'Hub' | 'Keyguard',
 *      version: string,
 *      date: string,
 *      message: string,
 *      env: 'main' | 'test',
 * }} Release
 */

/**
 *
 * @param {string} project_path
 * @param {string} token
 * @returns {Promise<Tag[]>}
 */
async function get_tags(project_path, token) {
    return fetch(`${api_base}/api/v4/projects/${encodeURIComponent(project_path)}/repository/tags`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    }).then(response => response.json())
}

/**
 *
 * @param {Tag} tag
 * @param {'Wallet' | 'Hub' | 'Keyguard'} app
 * @returns {Release}
 */
function toRelease(tag, app) {
    const version = tag.name.split('-').find(part => part.startsWith('v'))
    const date = new Date(tag.commit.authored_date).toJSON()
    const message = tag.commit.message.split('\n').filter(line => line && !line.startsWith('Nimiq')).join('\n')
    const env = tag.name.includes('test') ? 'test' : 'main'

    return {
        app,
        version,
        date,
        message,
        env,
    }
}

async function main() {
    console.log('Fetching Wallet tags...')
    const wallet_releases = (await get_tags('deployment/wallet', wallet_token))
        .map(tag => toRelease(tag, 'Wallet'))

    console.log('Fetching Hub tags...')
    const hub_releases = (await get_tags('deployment/hub', hub_token))
        .map(tag => toRelease(tag, 'Hub'))

    console.log('Fetching Keyguard tags...')
    const keyguard_releases = (await get_tags('deployment/keyguard', keyguard_token))
        .map(tag => toRelease(tag, 'Keyguard'))

    /** @type {Release[]} */
    const mainnet_releases = []
    /** @type {Release[]} */
    const testnet_releases = []

    for (const release of [...wallet_releases, ...hub_releases, ...keyguard_releases]) {
        if (release.message.includes('[exclude-release]')) continue

        if (release.env === 'test') {
            testnet_releases.push(release)
        } else {
            mainnet_releases.push(release)
        }
    }

    // Sort newest first
    mainnet_releases.sort((a, b) => a.date > b.date ? -1 : a.date === b.date ? 0 : 1)
    testnet_releases.sort((a, b) => a.date > b.date ? -1 : a.date === b.date ? 0 : 1)

    console.log('Writing Mainnet release JSON...')
    writeFileSync('./public/mainnet_releases.json', JSON.stringify(mainnet_releases))

    console.log('Writing Testnet release JSON...')
    writeFileSync('./public/testnet_releases.json', JSON.stringify(testnet_releases))

    console.log('FINISHED')
}

main()
