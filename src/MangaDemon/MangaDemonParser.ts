import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    PartialSourceManga,
    SourceManga,
    Tag,
    TagSection
} from '@paperback/types'

import { decode as decodeHTMLEntity } from 'html-entities'

import { CheerioAPI } from 'cheerio'

export const parseMangaDetails = ($: CheerioAPI, mangaId: string): SourceManga => {

    const mangaInfoStats = $('li', $('#manga-info-stats')).toArray()
    const imageObj = $('img', $('#manga-page'))
    const image = imageObj.attr('src') ?? ''
    const titles = [(decodeHTMLEntity(imageObj.attr('alt') ?? ''?.trim() ?? ''))]
    const author = $(mangaInfoStats[1]).text().trim()
    const description = decodeHTMLEntity($('div.white-font').text().trim() ?? '')

    const arrayTags: Tag[] = []
    for (const tag of $('li', 'div.genres-list').toArray()) {
        const label = $(tag).text().trim()
        if (!label) continue

        arrayTags.push({ id: label, label: label })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]

    const rawStatus = $(mangaInfoStats[5]).text().trim()
    let status = 'ONGOING'
    switch (rawStatus.toUpperCase()) {
        case 'ONGOING':
            status = 'Ongoing'
            break
        case 'COMPLETED':
            status = 'Completed'
            break
        default:
            status = 'Ongoing'
            break
    }

    return App.createSourceManga({
        id: mangaId,
        mangaInfo: App.createMangaInfo({
            titles: titles,
            image: encodeURI(image),
            status: status,
            author: author,
            artist: author,
            tags: tagSections,
            desc: description
        })
    })
}

export const parseChapters = ($: CheerioAPI, mangaId: string): Chapter[] => {
    const chapters: Chapter[] = []
    let sortingIndex = 0

    for (const chapter of $('li', '#chapters-list').toArray()) {
        const title = decodeHTMLEntity($($('a', chapter).contents()[0]).text().trim())

        const chapterId: string = $('a', chapter).attr('href')?.split('?').pop() ?? ''
        if (!chapterId) continue

        const date = new Date($('span', chapter).text() ?? '')
        const chapNumRegex = title.match(/(\d+\.?\d?(?:[-_]\d+)?)|(\d+\.?\d?(?:[-_]\d+)?)$/)

        let chapNum = 0
        if (chapNumRegex && chapNumRegex[1]) {
            chapNum = parseFloat(chapNumRegex[1].replace(/[-_]/gm, '.')) ?? 0
        }

        chapters.push({
            id: chapterId,
            name: `Chapter ${chapNum}`,
            langCode: '🇬🇧',
            chapNum: chapNum,
            time: date,
            sortingIndex,
            volume: 0,
            group: ''
        })
        sortingIndex--
    }

    if (chapters.length == 0) {
        throw new Error(`Couldn't find any chapters for mangaId: ${mangaId}!`)
    }

    return chapters.map(chapter => {
        chapter.sortingIndex += chapters.length
        return App.createChapter(chapter)
    })
}

export const parseChapterDetails = async ($: CheerioAPI, mangaId: string, chapterId: string): Promise<ChapterDetails> => {
    const pages: string[] = []

    for (const img of $('img.imgholder').toArray()) {
        let image = $(img).attr('src') ?? ''
        if (!image) image = $(img).attr('data-src') ?? ''
        
        if (!image || !$(img).attr('alt')?.length) continue
        pages.push(encodeURI(image))
    }

    return App.createChapterDetails({
        id: chapterId,
        mangaId: mangaId,
        pages: pages
    })
}

export const parseHomeSections = ($: CheerioAPI, sectionCallback: (section: HomeSection) => void): void => {

    const featuredSection = App.createHomeSection({
        id: 'featured',
        title: 'Our Translation',
        containsMoreItems: false,
        type: HomeSectionType.featured
    })

    const newSection = App.createHomeSection({
        id: 'new',
        title: 'New Manga',
        containsMoreItems: false,
        type: HomeSectionType.singleRowNormal
    })

    const mostViewedSection = App.createHomeSection({
        id: 'most_viewed',
        title: 'Most Viewed Today',
        containsMoreItems: false,
        type: HomeSectionType.singleRowNormal
    })

    const updateSection = App.createHomeSection({
        id: 'updated',
        title: 'Recent Updates',
        containsMoreItems: true,
        type: HomeSectionType.singleRowNormal
    })

    // Featured
    const featuredSection_Array: PartialSourceManga[] = []

    for (const manga of $('div.owl-element', $('h1:contains(Our Latest Translations)').next()).toArray()) {
        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('img', manga).first().attr('alt') ?? ''
        const id = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        const subtitle: string = $('div:contains(Chapter)', manga).text().trim() ?? ''

        if (!id || !title) continue
        featuredSection_Array.push(App.createPartialSourceManga({
            image: encodeURI(image),
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: decodeHTMLEntity(subtitle)
        }))
    }
    featuredSection.items = featuredSection_Array
    sectionCallback(featuredSection)

    // New
    const newSection_Array: PartialSourceManga[] = []
    for (const manga of $('div.owl-element', $('h1:contains(New Titles)').next()).toArray()) {
        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('img', manga).first().attr('alt') ?? ''
        const id = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''

        if (!id || !title) continue
        newSection_Array.push(App.createPartialSourceManga({
            image: encodeURI(image),
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: undefined
        }))
    }
    newSection.items = newSection_Array
    sectionCallback(newSection)

    // Most Viewed
    const mostViewedSection_Array: PartialSourceManga[] = []
    for (const manga of $('div.owl-element', $('h1:contains(Most Viewed Today)').next()).toArray()) {
        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('img', manga).first().attr('alt') ?? ''
        const id = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''

        if (!id || !title) continue
        mostViewedSection_Array.push(App.createPartialSourceManga({
            image: encodeURI(image),
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: undefined
        }))
    }
    mostViewedSection.items = mostViewedSection_Array
    sectionCallback(mostViewedSection)

    // Updated
    const updateSection_Array: PartialSourceManga[] = []
    for (const manga of $('.updates-element').toArray()) {
        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('img', manga).first().attr('alt') ?? ''
        const id = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        const subtitle: string = $('a.chplinks', manga).first().text().trim() ?? ''

        if (!id || !title) continue
        updateSection_Array.push(App.createPartialSourceManga({
            image: encodeURI(image),
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: decodeHTMLEntity(subtitle)
        }))
    }
    updateSection.items = updateSection_Array
    sectionCallback(updateSection)
}

export const parseViewMore = ($: CheerioAPI): PartialSourceManga[] => {
    const manga: PartialSourceManga[] = []
    const collectedIds: string[] = []

    for (const item of $('.updates-element').toArray()) {
        const image: string = $('img', item).first().attr('src') ?? ''
        const title: string = $('img', item).first().attr('alt') ?? ''
        const id = $('a', item).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        const subtitle: string = $('a.chplinks', item).first().text().trim() ?? ''

        if (!id || !title || collectedIds.includes(id)) continue
        manga.push(App.createPartialSourceManga({
            image: encodeURI(image),
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: decodeHTMLEntity(subtitle)
        }))
        collectedIds.push(id)
    }

    return manga
}

export const parseTags = ($: CheerioAPI): TagSection[] => {
    const arrayTags: Tag[] = []
    for (const tag of $('li.border-box', 'div#genres-container').toArray()) {
        const label = $(tag).text().trim()
        const id = $('input.genrespick', tag).attr('value')

        if (!id || !label) continue

        arrayTags.push({ id: id, label: label })
    }
    return [
        App.createTagSection({
            id: '0',
            label: 'genres',
            tags: arrayTags.map(x => App.createTag(x))
        })
    ]
}

export const parseSearch = ($: CheerioAPI, isTagSearch: boolean): PartialSourceManga[] => {
    const mangas: PartialSourceManga[] = []

    if (isTagSearch) {
        for (const manga of $('div.advanced-element').toArray()) {
            const image: string = $('img', manga).first().attr('src') ?? ''
            const title: string = $('img', manga).first().attr('alt') ?? ''
            const id = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''

            if (!id || !title) continue
            mangas.push(App.createPartialSourceManga({
                image: encodeURI(image),
                title: decodeHTMLEntity(title),
                mangaId: id
            }))
        }
    } else {

        for (const obj of $('a').toArray()) {
            const imageDomain = 'https://readermc.org'

            const title: string = $('div:first-child', obj).text().trim() ?? ''
            const image = `${imageDomain}/images/thumbnails/${encodeURI(title)}.webp`
            const id = $(obj).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''

            if (!id || !title) continue
            mangas.push(App.createPartialSourceManga({
                image: image,
                title: decodeHTMLEntity(title),
                mangaId: id,
                subtitle: undefined
            }))
        }
    }
    return mangas
}