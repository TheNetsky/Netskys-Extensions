import {
    SourceManga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    ContentRating,
    BadgeColor,
    Request,
    Response,
    TagSection,
    SourceIntents,
    HomeSectionType,
    ChapterProviding,
    MangaProviding,
    SearchResultsProviding,
    Tag,
    HomePageSectionsProviding
} from '@paperback/types'

import * as cheerio from 'cheerio'

import {
    parseChapterDetails,
    parseChapters,
    parseHomeSections,
    parseMangaDetails,
    isLastPage
} from './MitakuParser'

const MT_DOMAIN = 'https://mitaku.net'

export const MitakuInfo: SourceInfo = {
    version: '1.0.4',
    name: 'Mitaku',
    icon: 'icon.png',
    author: 'Netsky',
    authorWebsite: 'https://github.com/TheNetsky',
    description: 'Extension that pulls manga from mitaku.net',
    contentRating: ContentRating.ADULT,
    websiteBaseURL: MT_DOMAIN,
    sourceTags: [
        {
            text: '18+',
            type: BadgeColor.YELLOW
        }
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED
}

export class Mitaku implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {

    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': `${MT_DOMAIN}/`,
                        'user-agent': await this.requestManager.getDefaultUserAgent()
                    }
                }
                return request
            },
            interceptResponse: async (response: Response): Promise<Response> => {
                return response
            }
        }
    });

    getMangaShareUrl(mangaId: string): string { return `${MT_DOMAIN}/?p=${mangaId}` }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${MT_DOMAIN}/?p=${mangaId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        this.CloudFlareError(response.status)
        const $ = cheerio.load(response.data as string)
        return parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        return parseChapters(mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${MT_DOMAIN}/?p=${chapterId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        this.CloudFlareError(response.status)
        const $ = cheerio.load(response.data as string)
        return parseChapterDetails($, mangaId, chapterId)
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sections = [
            {
                request: App.createRequest({
                    url: `${MT_DOMAIN}/category/ero-cosplay`,
                    method: 'GET'
                }),
                sectionID: App.createHomeSection({
                    id: 'cosplay',
                    title: 'Cosplay Galleries',
                    containsMoreItems: true,
                    type: HomeSectionType.singleRowNormal
                })
            },
            {
                request: App.createRequest({
                    url: `${MT_DOMAIN}/category/nude`,
                    method: 'GET'
                }),
                sectionID: App.createHomeSection({
                    id: 'nude',
                    title: 'Nude Galleries',
                    containsMoreItems: true,
                    type: HomeSectionType.singleRowNormal
                })
            },
            {
                request: App.createRequest({
                    url: `${MT_DOMAIN}/category/sexy-set`,
                    method: 'GET'
                }),
                sectionID: App.createHomeSection({
                    id: 'sexy-set',
                    title: 'Sexy Set Galleries',
                    containsMoreItems: true,
                    type: HomeSectionType.singleRowNormal
                })
            }
        ]

        const promises: Promise<void>[] = []

        for (const section of sections) {
            sectionCallback(section.sectionID)
            promises.push(
                this.requestManager.schedule(section.request, 1)
                    .then(response => {
                        this.CloudFlareError(response.status)
                        const $ = cheerio.load(response.data as string)
                        const items = parseHomeSections($)
                        section.sectionID.items = items
                        sectionCallback(section.sectionID)
                    })
            )
        }

        await Promise.all(promises)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        if (metadata?.completed) return metadata

        const page: number = metadata?.page ?? 1
        let param = ''

        switch (homepageSectionId) {
            case 'cosplay':
                param = `category/ero-cosplay/page/${page}`
                break
            case 'nude':
                param = `category/nude/page/${page}`
                break
            case 'sexy-set':
                param = `category/sexy-set/page/${page}`
                break
            default:
                throw new Error('Requested to getViewMoreItems for a section ID which doesn\'t exist')
        }

        const request = App.createRequest({
            url: `${MT_DOMAIN}/${param}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        this.CloudFlareError(response.status)
        const $ = cheerio.load(response.data as string)
        const manga = parseHomeSections($)

        metadata = !isLastPage($) ? { page: page + 1 } : undefined
        return App.createPagedResults({
            results: manga,
            metadata
        })
    }

    async getSearchTags(): Promise<TagSection[]> {
        const request = App.createRequest({
            url: `${MT_DOMAIN}/wp-json/wp/v2/tags?per_page=100`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const tagJSON = JSON.parse(response.data as string)

        const arrayTags: Tag[] = []

        for (const tag of tagJSON) {
            const label = tag.name
            const id = tag.slug

            if (!id || !label) continue
            arrayTags.push({ id: id, label: label })
        }

        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]
        return tagSections
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page: number = metadata?.page ?? 1

        let request
        // Regular search
        if (query.title) {
            request = App.createRequest({
                url: `${MT_DOMAIN}/page/${page}?s=${encodeURI(query.title)}`,
                method: 'GET'
            })

            // Tag Search
        } else {
            request = App.createRequest({
                url: `${MT_DOMAIN}/tag/${query?.includedTags?.map((x: Tag) => x.id)[0]}/page/${page}`,
                method: 'GET'
            })
        }

        const response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data as string)
        const manga = parseHomeSections($)

        metadata = !isLastPage($) ? { page: page + 1 } : undefined
        return App.createPagedResults({
            results: manga,
            metadata
        })
    }

    CloudFlareError(status: number): void {
        if (status == 503 || status == 403) {
            throw new Error(`CLOUDFLARE BYPASS ERROR:\nPlease go to the homepage of <${Mitaku.name}> and press the cloud icon.`)
        }
    }

    async getCloudflareBypassRequestAsync(): Promise<Request> {
        return App.createRequest({
            url: MT_DOMAIN,
            method: 'GET',
            headers: {
                'referer': `${MT_DOMAIN}/`,
                'user-agent': await this.requestManager.getDefaultUserAgent()
            }
        })
    }
}
