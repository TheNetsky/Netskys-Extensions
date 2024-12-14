import {
    Chapter,
    ChapterDetails,
    Tag,
    SourceManga,
    PartialSourceManga,
    TagSection
} from '@paperback/types'

import { decode as decodeHTMLEntity } from 'html-entities'

import {
    Cheerio,
    CheerioAPI
} from 'cheerio'

import { type Element } from 'domhandler'

export const parseMangaDetails = ($: CheerioAPI, mangaId: string): SourceManga => {
    const images = parseImages($)

    const title = decodeHTMLEntity($('h1.cm-entry-title').first().text().trim())
    const artist = decodeHTMLEntity($('p:contains(Cosplayer:)').text().trim().replace('Cosplayer:', '').trim())
    const description = `Cosplayer: ${artist}\n\nGallery: ${title}\n\nImages: ${images.length}`


    const arrayTags: Tag[] = []
    for (const tag of $('a', 'span.tag-links').toArray()) {
        const id = $(tag).attr('href')?.split('/tag/')[1]?.replace(/\//g, '')
        const label = $(tag).text().trim()
        if (!id || !label) continue
        arrayTags.push({ id: id, label: label })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]

    return App.createSourceManga({
        id: mangaId,
        mangaInfo: App.createMangaInfo({
            titles: [title],
            artist: artist,
            author: artist,
            status: 'Completed',
            image: encodeURI(images[0] ?? ''),
            desc: description,
            tags: tagSections
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

export const parseChapterDetails = ($: CheerioAPI, mangaId: string, chapterId: string): ChapterDetails => {

    const chapterDetails = App.createChapterDetails({
        id: chapterId,
        mangaId: mangaId,
        pages: parseImages($)
    })
    return chapterDetails
}

export const parseHomeSections = ($: CheerioAPI): PartialSourceManga[] => {
    const collectedIds: string[] = []
    const itemArray: PartialSourceManga[] = []

    for (const item of $('article', 'div#cm-primary').toArray()) {
        const postId = $(item).attr('id')
        const id = postId?.split('post-').pop()
        const image: string = getImageSrc($('img', item).first()) ?? ''
        const title: string = $('h2.cm-entry-title', item).text().trim() ?? ''
        const subtitle: string = $('span.cm-tag-links > a', item).toArray().map(x => $(x).text().trim()).join(', ')

        if (!id || isNaN(Number(id)) || !title || collectedIds.includes(id) || !subtitle) continue
        itemArray.push(App.createPartialSourceManga({
            image: encodeURI(image),
            title: decodeHTMLEntity(title),
            mangaId: id,
            subtitle: decodeHTMLEntity(subtitle)
        }))
        collectedIds.push(id)
    }

    return itemArray
}

const parseImages = ($: CheerioAPI): string[] => {
    const images: string[] = []
    for (const img of $('a', 'div.msacwl-slider-wrap').toArray()) {

        let image = $(img).attr('src')
        if (!image) image = $(img).attr('data-mfp-src')
        if (!image) image = $(img).attr('data-lazy')

        if (!image) continue
        images.push(image)
    }

    return images
}

const getImageSrc = (imageObj: Cheerio<Element>): string => {
    let image: string | undefined
    if ((typeof imageObj?.attr('data-src')) != 'undefined') {
        image = imageObj?.attr('data-src')
    }
    else if ((typeof imageObj?.attr('data-lazy-src')) != 'undefined') {
        image = imageObj?.attr('data-lazy-src')
    }
    else if ((typeof imageObj?.attr('srcset')) != 'undefined') {
        image = imageObj?.attr('srcset')?.split(' ')[0] ?? ''
    }
    else if ((typeof imageObj?.attr('src')) != 'undefined') {
        image = imageObj?.attr('src')
    }
    else if ((typeof imageObj?.attr('data-cfsrc')) != 'undefined') {
        image = imageObj?.attr('data-cfsrc')
    } else {
        image = ''
    }

    return encodeURI(decodeURI(decodeHTMLEntity(image?.trim() ?? '')))
}

export const isLastPage = ($: CheerioAPI): boolean => {
    let isLast = true
    const hasNext = Boolean($('a.last', 'div.wp-pagenavi').first())

    if (hasNext) isLast = false
    return isLast
}