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

    titles.push(decodeHTMLEntity($('div.info-title > h1').text()?.trim() ?? ''))
    const altTitles = $('div.info-title > h3').text().trim().split(';')
    for (const title of altTitles) {
        titles.push(decodeHTMLEntity(title.trim()))
    }

    const image = $('img', 'div.col-md-4.col-sm-4.info-img').attr('src') ?? ''
    const description = decodeHTMLEntity($('div.content-info > div').first().text().trim() ?? '')

    const infoSections = $('.info-c').first()
    const author = $($('.info', infoSections).get(0)).text().trim()
    const artist = $($('.info', infoSections).get(1)).text().trim()

    const arrayTags: Tag[] = []
    for (const tag of $('a', $('.info', infoSections).get(3)).toArray()) {
        const label = $(tag).text().trim()
        const id = encodeURI(idCleaner($(tag).attr('href')?.split('/').pop()?.trim() ?? ''))

        if (!id || !label) continue
        arrayTags.push({ id: id, label: label })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]

    const rawStatus = $($('.info', infoSections).get(4)).text().trim()
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
            artist: artist,
            tags: tagSections,
            desc: description
        })
    })
}

export const parseChapters = ($: CheerioAPI, mangaId: string, baseURL: string): Chapter[] => {
    const chapters: Chapter[] = []
    let sortingIndex = 0

    for (const chapter of $('tr', 'div.list-chapter').toArray()) {
        const title = decodeHTMLEntity($('td.name > a', chapter).children().remove().end().text().trim())
        const chapterId = $('a', chapter).attr('href')?.replace(baseURL + '/', '') ?? ''

        if (!chapterId || !title) continue

        const date = new Date($('td.date-updated', chapter).text().trim())

        const chapNumRegex = title.match(/chapter\s(\d+\.?\d*|\.\d+)/i)
        let chapNum = 0
        if (chapNumRegex && chapNumRegex[1]) chapNum = Number(chapNumRegex[1])

        const volNumRegex = title.match(/(?:vol|volume)\s(\d+\.?\d*|\.\d+)/i)
        let volNum = 0
        if (volNumRegex && volNumRegex[1]) volNum = Number(volNumRegex[1])

        chapters.push({
            id: chapterId,
            name: `Chapter ${chapNum}`,
            langCode: '🇬🇧',
            chapNum: chapNum,
            volume: volNum,
            time: date,
            sortingIndex,
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

    for (const img of $('img', 'div.img').toArray()) {
        let image = $(img).attr('src') ?? ''
        if (!image) image = $(img).attr('data-src') ?? ''
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
    const recommendSection = App.createHomeSection({
        id: 'recommend',
        title: 'Recommended',
        containsMoreItems: false,
        type: HomeSectionType.featured
    })

    const updateSection = App.createHomeSection({
        id: 'update',
        title: 'Latest Updated',
        containsMoreItems: true,
        type: HomeSectionType.singleRowNormal
    })

    const viewedTodaySection = App.createHomeSection({
        id: 'today',
        title: 'Most viewed today',
        containsMoreItems: false,
        type: HomeSectionType.singleRowNormal
    })

    // Recommend
    const recommendSection_Array: PartialSourceManga[] = []
    for (const manga of $('div.div_item', 'div.pinked-content').toArray()) {
        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('img', manga).first().attr('alt') ?? ''
        const id = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        const subtitle: string = $('a.name-chapter > span', manga).text().trim() ?? ''

        if (!id || !title) continue
        recommendSection_Array.push(App.createPartialSourceManga({
            image: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: decodeHTMLEntity(subtitle)
        }))
    }
    recommendSection.items = recommendSection_Array
    sectionCallback(recommendSection)

    // Update
    const updateSection_Array: PartialSourceManga[] = []
    for (const manga of $('div.div_item', 'div.col-xs-12.wrapper_content').toArray()) {
        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('img', manga).first().attr('alt') ?? ''
        const id = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        const subtitle: string = $('a.name-chapter > span', manga).text().trim() ?? ''

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

    // Viewed Today
    const viewedTodaySection_Array: PartialSourceManga[] = []
    for (const manga of $('li', 'div.col-xs-12.mgtop10.mvtd').toArray()) {
        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('img', manga).first().attr('alt') ?? ''
        const id = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        const subtitle: string = $('a.name-chapter > span', manga).text()?.replace('Read online', '').trim() ?? ''

        if (!id || !title) continue
        viewedTodaySection_Array.push(App.createPartialSourceManga({
            image: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: decodeHTMLEntity(subtitle)
        }))
    }
    viewedTodaySection.items = viewedTodaySection_Array
    sectionCallback(viewedTodaySection)
}

export const parseViewMore = ($: CheerioAPI): PartialSourceManga[] => {
    const manga: PartialSourceManga[] = []
    const collectedIds: string[] = []

    for (const obj of $('div.div_item', 'div.st_content > ul.list_manga').toArray()) {
        const image: string = $('img', obj).first().attr('src') ?? ''
        const title: string = $('img', obj).first().attr('alt') ?? ''
        const id = $('a', obj).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        const subtitle: string = $('a.name-chapter > span', obj).text()?.replace('Read online', '').trim() ?? ''

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

    for (const tag of $('li', 'li.dropdown.genres').toArray()) {
        const label = $(tag).text().trim() ?? ''
        const id = encodeURI(idCleaner($('a', tag).attr('href')?.split('/').pop()?.trim() ?? ''))

        if (!id || !label) continue
        arrayTags.push({ id: id, label: label })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]
    return tagSections
}

export const isLastPage = ($: CheerioAPI): boolean => {
    let isLast = true
    const hasNext = Boolean($('a:contains(Last)', 'div.pagination-ct').first())

    if (hasNext) isLast = false
    return isLast
}

const idCleaner = (str: string): string => {
    return str.split('?').shift() ?? ''
}