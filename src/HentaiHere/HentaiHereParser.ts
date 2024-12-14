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

    titles.push(decodeHTMLEntity($('h4 > a').children().remove().end().text().trim() ?? ''))
    const image = $('img', 'div#cover').attr('src') ?? ''
    const artist = $('span:contains(Artist:)').next().text().trim()
    const description = decodeHTMLEntity($('span:contains(Brief Summary:)').parent().text().replace($('span:contains(Brief Summary:)').text(), '').trim())

    // Content Tags
    const arrayTags: Tag[] = []
    for (const tag of $('a.tagbutton', $('span:contains(Content:)').parent()).toArray()) {
        const label = $(tag).text().trim()
        const id = $(tag).attr('href')?.split('/').pop()?.trim() ?? ''

        if (!id || !label || label == '-') continue
        arrayTags.push({ id: id, label: label })
    }

    // Category Tags
    for (const tag of $('a.tagbutton', $('span:contains(Catergory:)').parent()).toArray()) {
        const label = $(tag).text().trim()
        const id = $(tag).attr('href')?.split('/').pop()?.trim() ?? ''

        if (!id || !label || label == '-') continue
        arrayTags.push({ id: id, label: label })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]

    const rawStatus = $('span:contains(Status:)').next().text().trim()
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
            author: artist == '-' ? '' : artist,
            artist: artist == '-' ? '' : artist,
            tags: tagSections,
            desc: description
        })
    })
}

export const parseChapters = ($: CheerioAPI): Chapter[] => {
    const chapters: Chapter[] = []

    for (const chapter of $('li.sub-chp', 'ul.arf-list').toArray()) {
        const title = decodeHTMLEntity($('span.pull-left', chapter).text().replace($('span.pull-left i.text-muted', chapter).text(), '').trim())
        const chapterIdRaw = $('a', chapter).attr('href') ?? ''
        const chapterIdRegex = chapterIdRaw?.match(/m\/[A-z0-9]+\/(\d+)/)

        let chapterId: string | null = null
        if (chapterIdRegex && chapterIdRegex[1]) chapterId = chapterIdRegex[1]

        if (!chapterId) continue
        const date = new Date()
        const chapterNumber = isNaN(Number(chapterId)) ? 0 : Number(chapterId)
        chapters.push(App.createChapter({
            id: chapterId,
            name: title,
            langCode: '🇬🇧',
            chapNum: chapterNumber,
            time: date
        }))
    }
    return chapters
}

export const parseChapterDetails = (data: string, mangaId: string, chapterId: string): ChapterDetails => {
    const pages: string[] = []

    let obj = /var rff_imageList = (.*);/.exec(data)?.[1] ?? '' // Get the data else return null.
    if (obj == '') throw new Error('Unable to parse chapter details!') // If null, throw error, else parse data to json.
    obj = JSON.parse(obj)
    for (const i of obj) {
        const page = 'https://hentaicdn.com/hentai' + i
        pages.push(page)
    }

    const chapterDetails = App.createChapterDetails({
        id: chapterId,
        mangaId: mangaId,
        pages: pages
    })
    return chapterDetails
}

export const parseHomeSections = ($: CheerioAPI, sectionCallback: (section: HomeSection) => void): void => {
    const staffSection = App.createHomeSection({
        id: 'staff_pick',
        title: 'Staff Picks',
        containsMoreItems: true,
        type: HomeSectionType.singleRowLarge
    })

    const newestSection = App.createHomeSection({
        id: 'newest',
        title: 'Recently Added',
        containsMoreItems: true,
        type: HomeSectionType.singleRowNormal
    })

    const trendingSection = App.createHomeSection({
        id: 'trending',
        title: 'Trending',
        containsMoreItems: true,
        type: HomeSectionType.singleRowNormal
    })

    // Staff Pick
    const staffSection_Array: PartialSourceManga[] = []
    for (const manga of $('div.item', 'div#staffpick').toArray()) {
        const image: string = $('img', manga).attr('src') ?? ''
        const title: string = $('img', manga).attr('alt')?.trim() ?? ''
        const id = $('a', manga).attr('href')?.split('/').pop()?.trim()
        const subtitle: string = $('b.text-danger', manga).text().trim()

        if (!id || !title) continue
        staffSection_Array.push(App.createPartialSourceManga({
            image: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: subtitle
        }))
    }
    staffSection.items = staffSection_Array
    sectionCallback(staffSection)

    // Recently Added
    const newestSection_Array: PartialSourceManga[] = []
    for (const manga of $($('div.row.row-sm')[1]).children('div').toArray()) {
        const image: string = $('img', manga).attr('src') ?? ''
        const title: string = $('img', manga).attr('alt')?.trim() ?? ''
        const id = $('a', manga).attr('href')?.split('/').pop()?.trim()
        const subtitle: string = $('span.label.label-danger', manga).text().trim()

        if (!id || !title) continue
        newestSection_Array.push(App.createPartialSourceManga({
            image: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: subtitle
        }))
    }
    newestSection.items = newestSection_Array
    sectionCallback(newestSection)

    // Trending
    const trendingSection_Array: PartialSourceManga[] = []
    for (const manga of $($('div.row.row-sm')[1]).children('div').toArray()) {
        const image = $('img', manga).attr('src') ?? ''
        const title = $('img', manga).attr('alt')?.trim() ?? ''
        const id = $('a', manga).attr('href')?.split('/').pop()?.trim()

        if (!id || !title) continue
        trendingSection_Array.push(App.createPartialSourceManga({
            image: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: undefined
        }))
    }
    trendingSection.items = trendingSection_Array
    sectionCallback(trendingSection)
}

export const parseViewMore = ($: CheerioAPI): PartialSourceManga[] => {
    const manga: PartialSourceManga[] = []
    const collectedIds: string[] = []

    for (const obj of $('div.item', 'div.row.row-sm').toArray()) {
        const image = $('img', obj).attr('src') ?? ''
        const id = $('a', obj).attr('href')?.split('/').pop()?.trim()
        const title = $('img', obj).attr('alt')?.trim()
        const subtitle = $('b.text-danger', obj).text()

        if (!id || !title || collectedIds.includes(id)) continue
        manga.push(App.createPartialSourceManga({
            image: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: subtitle
        }))
        collectedIds.push(id)
    }
    return manga
}

export const parseTags = ($: CheerioAPI): TagSection[] => {
    const arrayTags: Tag[] = []
    for (const tag of $('div.list-group.item', 'div.col-xs-12').toArray()) {
        const label = $('span.clear > a', tag).text().trim()
        const id = $('span.clear > a', tag).attr('href')?.split('/').pop()?.trim() ?? ''

        if (!id || !label) continue
        arrayTags.push({ id: id, label: label })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]
    return tagSections
}

export const parseSearch = ($: CheerioAPI): PartialSourceManga[] => {
    const mangas: PartialSourceManga[] = []

    for (const obj of $('div.item', 'div.row.row-sm').toArray()) {
        const id = $('a', obj).attr('href')?.split('/').pop()?.trim()
        const image = $('img', obj).attr('src') ?? ''
        const title = decodeHTMLEntity(String($('img', obj).attr('alt')?.trim()))
        const subtitle = $('b.text-danger', obj).text().trim()

        if (!id || !title) continue
        mangas.push(App.createPartialSourceManga({
            image: image,
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: subtitle
        }))
    }
    return mangas
}

export const isLastPage = ($: CheerioAPI): boolean => {
    let isLast = false
    const pages: number[] = []

    for (const page of $('li', 'ul.pagination').toArray()) {
        const p = Number($(page).text().trim())
        if (isNaN(p)) continue
        pages.push(p)
    }

    const lastPage = Math.max(...pages)
    const currentPage = Number($('li.active').text().trim())
    if (currentPage >= lastPage) isLast = true
    return isLast
}