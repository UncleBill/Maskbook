import { SUBGRAPH_URL, TWITTER_BEARER_TOKEN } from '../constants'
import { first } from 'lodash-unified'
import type { IdeaToken } from '../types'

export async function fetchIdeaToken(marketName: string, tokenName: string) {
    const body = {
        query: `query IdeaToken($tokenName: String!) {
            ideaTokens(where: {name: $tokenName}) {
                name
                tokenID
                market {
                    name
                }
                rank
                latestPricePoint {
                    price
                }
                supply
                holders
                daiInToken
            }
        }`,
        variables: { marketName: marketName, tokenName: tokenName },
    }
    const response = await fetch(SUBGRAPH_URL, {
        body: JSON.stringify(body),
        method: 'POST',
    })

    const res = (await response.json())?.data.ideaTokens
    return first(res) as IdeaToken
}

export async function fetchAllTokens(searchTerm: string, page: number, filters: number[]) {
    const rowsPerPage = 20
    const body = {
        query: `query IdeaToken($searchTerm: String!, $rowsPerPage: Int!, $skip: Int!, $filters: [Int!]!) {
            ideaTokens(first: $rowsPerPage, skip: $skip, orderBy: daiInToken, orderDirection: desc, where: { name_contains: $searchTerm, market_in: $filters }){
                id
                name
                tokenID
                market {
                    marketID
                    name
                }
                rank
                latestPricePoint {
                    price
                }
                supply
                holders
                daiInToken
                dayChange
            }
        }`,
        variables: {
            searchTerm: searchTerm,
            rowsPerPage: rowsPerPage,
            skip: page === 0 ? 0 : page * rowsPerPage,
            filters,
        },
    }
    const response = await fetch(SUBGRAPH_URL, {
        body: JSON.stringify(body),
        method: 'POST',
    })

    const res = (await response.json())?.data

    const requestTwitterData = res?.ideaTokens.map(async (token: IdeaToken) => {
        if (token.market.name === 'Twitter') {
            const twitterData = await fetchTwitterLookup(token)
            return { ...token, twitter: twitterData }
        }

        return token
    })

    const tokensWithTwitterData = await Promise.all(requestTwitterData)

    return tokensWithTwitterData
}

export async function fetchUserTokensBalances(holder: string) {
    const body = {
        query: `query IdeaTokenBalances ($holder: String!) {
            ideaTokenBalances(where: {holder: $holder}){
                token {
                    id
                    name
                    market {
                        name
                    }
                    latestPricePoint {
                      price
                    }
                    daiInToken
                    dayChange
                }
                id
                holder
                amount
            }
        }`,
        variables: { holder },
    }
    const response = await fetch(SUBGRAPH_URL, {
        body: JSON.stringify(body),
        method: 'POST',
    })

    const res = (await response.json())?.data

    return res
}

export async function fetchTwitterLookup(token: IdeaToken) {
    const response = await fetch(
        `https://api.twitter.com/2/users/by/username/${token.name.slice(1)}?user.fields=profile_image_url`,
        {
            headers: {
                Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
            },
        },
    )
    const res = (await response.json())?.data
    return res
}
