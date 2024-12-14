import {
    Chapter,
    ChapterDetails,
    HomeSection,
    SourceManga,
    PartialSourceManga,
    HomeSectionType,
    Tag,
    TagSection
} from '@paperback/types'

import { decode as decodeHTMLEntity } from 'html-entities'
import { CheerioAPI } from 'cheerio'

export const parseMangaDetails = ($: CheerioAPI, mangaId: string): SourceManga => {
    const title: string = decodeHTMLEntity($('span#title > h2').text().trim())

    const image = $('img', $('div.icon-overlay')).first().attr('src') ?? ''
    const description = `Gallery: ${title}`

    const arrayTags: Tag[] = []
    for (const tag of $('span', 'p#detail_tag').toArray()) {
        const id = $('a', tag).attr('href')?.trim().replace(/\/$/, '').split('/').pop()

        if (!id) continue
        arrayTags.push({ id: id, label: id })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'tags', tags: arrayTags.map(x => App.createTag(x)) })]

    return App.createSourceManga({
        id: mangaId,
        mangaInfo: App.createMangaInfo({
            titles: [title],
            image: image,
            status: 'Completed',
            tags: tagSections,
            desc: description
        })
    })
}

export const parseChapters = (mangaId: string): Chapter[] => {
    return [App.createChapter({
        id: mangaId,
        name: 'Gallery',
        langCode: '🇬🇧',
        chapNum: 1
    })]
}

export const parseChapterDetails = ($: CheerioAPI, mangaId: string): ChapterDetails => {
    const pages: string[] = []


    for (const img of $('amp-story-grid-layer > amp-img').toArray()) {
        const image = $(img).attr('src') ?? ''
        if (!image) continue
        pages.push(image)
    }

    const chapterDetails = App.createChapterDetails({
        id: mangaId,
        mangaId: mangaId,
        pages: pages
    })
    return chapterDetails
}

export const parseHomeSections = ($: CheerioAPI, sectionCallback: (section: HomeSection) => void): void => {
    const sections = [
        {
            sectionID: App.createHomeSection({
                id: 'top_rated',
                title: 'Most Popular Galleries',
                containsMoreItems: true,
                type: HomeSectionType.singleRowLarge
            }),
            selector: $('ul#image-list').get(2)
        },
        {
            sectionID: App.createHomeSection({
                id: 'new',
                title: 'New Galleries',
                containsMoreItems: true,
                type: HomeSectionType.singleRowLarge
            }),
            selector: $('ul#image-list').get(1)
        }
    ]

    const collectedIds: string[] = []

    for (const section of sections) {

        const itemArray: PartialSourceManga[] = []
        for (const item of $('div.image-list-item', section.selector).toArray()) {
            const id = $('a', item).attr('href')?.replace('/image', '').replace('/', '')
            const image: string = $('img', item).first().attr('src') ?? ''
            const title: string = $('p.image-list-item-title > a', item).text().trim()
            const subtitle: string = $('p.image-list-item-regist-date > span', item).text().trim()

            if (!id || !title || collectedIds.includes(id)) continue
            itemArray.push(App.createPartialSourceManga({
                image: image,
                title: title,
                mangaId: id,
                subtitle: subtitle
            }))
            collectedIds.push(id)

        }
        section.sectionID.items = itemArray
        sectionCallback(section.sectionID)
    }
}

export const parseViewMore = ($: CheerioAPI): PartialSourceManga[] => {
    const manga: PartialSourceManga[] = []
    const collectedIds: string[] = []

    for (const item of $('div.image-list-item', 'ul#image-list').toArray()) {
        const id = $('a', item).attr('href')?.replace('/image', '').replace('/', '')
        const image: string = $('img', item).first().attr('src') ?? ''
        const title: string = $('p.image-list-item-title > a', item).text().trim()
        const subtitle: string = $('p.image-list-item-regist-date > span', item).text().trim()

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
    for (const tag of $('#tags li').toArray()) {
        const id = $('a', tag).attr('href')?.trim().replace(/\/$/, '').split('/').pop()

        if (!id) continue
        arrayTags.push({ id: id, label: id })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'tags', tags: arrayTags.map(x => App.createTag(x)) })]
    return tagSections
}

export const isLastPage = ($: CheerioAPI): boolean => {
    let isLast = false

    const lastPage = $('div.wp-pagenavi > a.last').attr('href')
    if (!lastPage) isLast = true

    return isLast
}