import {
    Chapter,
    ChapterDetails,
    Tag,
    HomeSection,
    SourceManga,
    PartialSourceManga,
    TagSection,
    HomeSectionType
} from '@paperback/types'

import { decode as decodeHTMLEntity } from 'html-entities'
import { CheerioAPI } from 'cheerio'

export const parseMangaDetails = ($: CheerioAPI, mangaId: string): SourceManga => {
    const titles: string[] = []

    titles.push(decodeHTMLEntity($('td:contains(Name:)').first().next().text().trim()))
    titles.push(decodeHTMLEntity($('td:contains(Alternate Name:)').next().text().trim()))

    let image = $('img', 'div.manga-image').attr('src') ?? ''
    image = image.startsWith('/') ? 'https:' + image : image

    const author = $('td:contains(Author:)').next().text().trim()
    const description = decodeHTMLEntity($('p.pdesc').text().trim())

    const arrayTags: Tag[] = []
    for (const tag of $('a', $('td:contains(Genre)').next()).toArray()) {
        const label = $(tag).text().trim()
        const id = label.replace(/\s/g, '+')

        if (!id || !label) continue
        arrayTags.push({ id: id, label: label })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]

    const rawStatus = $('td:contains(Status:)').next().text().trim()
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
            image: image,
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

    for (const chapter of $('li', 'ul.basic-list').toArray()) {

        const title = decodeHTMLEntity($('a.ch-name', chapter).text().trim())
        const chapterId: string = $('a', chapter).attr('href')?.split('/').pop() ?? ''

        if (!chapterId) continue

        const date = new Date($('span', chapter).text())
        const chapNumRegex = chapterId.match(/(\d+\.?\d?)+/)

        let chapNum = 0
        if (chapNumRegex && chapNumRegex[1]) chapNum = Number(chapNumRegex[1])

        chapters.push({
            id: chapterId,
            name: title,
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

export const parseChapterDetails = ($: CheerioAPI, mangaId: string, chapterId: string): ChapterDetails => {
    const pages: string[] = []

    for (const img of $('img', 'div.chapter-container').toArray()) {
        const image = img.attribs['data-original']
        if (!image) continue
        pages.push(image)
    }

    const chapterDetails = App.createChapterDetails({
        id: chapterId,
        mangaId: mangaId,
        pages: pages
    })

    return chapterDetails
}

export const parseHomeSections = ($: CheerioAPI, sectionCallback: (section: HomeSection) => void): void => {
    const popularSection = App.createHomeSection({
        id: 'popular',
        title: 'Popular Comics',
        containsMoreItems: true,
        type: HomeSectionType.singleRowLarge
    })

    const updateSection = App.createHomeSection({
        id: 'update',
        title: 'Latest Updates Comics',
        containsMoreItems: false,
        type: HomeSectionType.singleRowNormal
    })

    // Popular
    const popularSection_Array: PartialSourceManga[] = []
    for (const manga of $('li.list-top-movie-item', 'div.right-box-content').toArray()) {
        let image: string = $('div.list-top-movie-item-thumb', manga).attr('style') ?? ''

        const urlRegex = image.match(/url\(['"]?(.*?)['"]?\)/)

        if (urlRegex && urlRegex[1]) image = urlRegex[1]

        const title: string = $('span.list-top-movie-item-vn', manga).text().trim() ?? ''
        const id = $('a', manga).attr('href')?.split('/').pop()?.trim()

        let subtitle: string = $('a.chapter', manga).text() ?? ''
        subtitle = subtitle.substring(subtitle.indexOf('#'))?.trim()

        if (!id || !title) continue
        popularSection_Array.push(App.createPartialSourceManga({
            image: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: decodeHTMLEntity(subtitle)
        }))
    }
    popularSection.items = popularSection_Array
    sectionCallback(popularSection)

    // Update
    const updateSection_Array: PartialSourceManga[] = []
    for (const manga of $('li.manga-box', 'ul.home-list').toArray()) {
        const image: string = $('img', manga).attr('src') ?? ''
        const title: string = $('img', manga).attr('alt')?.trim() ?? ''
        const id = $('a', manga).attr('href')?.split('/').pop()?.trim()

        let subtitle: string = $('div.detail > a', manga).text().trim()
        subtitle = subtitle.substring(subtitle.indexOf('#'))?.trim()

        if (!id || !title) continue
        updateSection_Array.push(App.createPartialSourceManga({
            image: image,
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

    for (const obj of $('div.manga-box', 'div.container').toArray()) {

        const image: string = $('img', obj).attr('src') ?? ''
        const title: string = $('img', obj).attr('alt')?.trim() ?? ''
        const id = $('a', obj).attr('href')?.split('/').pop()?.trim()

        let subtitle: string = $('div.detail > a', obj).first().text().trim()
        subtitle = subtitle.substring(subtitle.indexOf('#'))?.trim()

        if (!id || !title || collectedIds.includes(id)) continue
        manga.push(App.createPartialSourceManga({
            image: image,
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

    for (const tag of $('li', 'ul.search-checks').toArray()) {
        const label = $(tag).text().trim() ?? ''
        const id = $(tag).text().trim().replace(/\s/g, '+') ?? ''

        if (!id || !label) continue
        arrayTags.push({ id: id, label: label })
    }

    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]
    return tagSections
}

export const parseSearch = ($: CheerioAPI): PartialSourceManga[] => {
    const mangas: PartialSourceManga[] = []

    for (const obj of $('div.manga-box', 'div.result-left').toArray()) {
        const id = $('a', obj).attr('href')?.split('/').pop()?.trim()
        const image: string = $('img', obj).attr('src') ?? ''
        const title: string = $('img', obj).attr('alt')?.trim() ?? ''
        const subtitle: string = $('div.detail', obj).first().text().trim()

        if (!id || !title) continue

        mangas.push(App.createPartialSourceManga({
            image: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: decodeHTMLEntity(subtitle)
        }))
    }
    return mangas
}

export const isLastPage = ($: CheerioAPI): boolean => {
    let isLast = false
    const items: string[] = []

    for (const page of $('a', 'div.general-nav').toArray()) {
        items.push($(page).text().trim().toLowerCase())
    }

    if (!items.includes('next')) isLast = true
    return isLast
}
