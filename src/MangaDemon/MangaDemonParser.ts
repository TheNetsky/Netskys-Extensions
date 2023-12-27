import {
    Chapter,
    ChapterDetails,
    Tag,
    HomeSection,
    SourceManga,
    PartialSourceManga,
    TagSection,
    HomeSectionType,
    RequestManager
} from '@paperback/types'

import entities = require('entities')

const MD_DOMAIN = 'https://demoncomics.org'

export const parseMangaDetails = ($: CheerioStatic, mangaId: string): SourceManga => {

    const image = $('img', 'figure.cover').attr('src') ?? ''
    const titles = [(decodeHTMLEntity($('img', 'figure.cover').attr('alt') ?? ''?.trim() ?? ''))]
    const author = $('span', 'div.author').last().text().trim()
    const description = decodeHTMLEntity($('p.description').text().trim() ?? '')

    const arrayTags: Tag[] = []
    for (const tag of $('li', 'div.categories').toArray()) {
        const label = $(tag).text().trim()
        const idRegex = $('a', tag).attr('href')?.match(/genre\[\]=(\d+)/)

        let id = ''
        if (idRegex && idRegex[1]) {
            id = idRegex[1]
        }

        if (!id || !label) continue

        arrayTags.push({ id: id, label: label })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]

    const rawStatus = $('strong', $('small:contains(Status)').parent()).text().trim()
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

export const parseChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
    const chapters: Chapter[] = []
    let sortingIndex = 0

    for (const chapter of $('li', 'ul.chapter-list').toArray()) {
        const title = decodeHTMLEntity($('strong.chapter-title', chapter).text().trim())
        const chapterId: string = $('a', chapter).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        if (!chapterId) continue

        const date = new Date($('time.chapter-update', chapter).attr('date')?.toString() ?? '')
        const chapNumRegex = title.match(/(\d+)(?:[-.]\d+)?/)

        let chapNum = 0
        if (chapNumRegex && chapNumRegex[1]) {
            let chapRegex = chapNumRegex[1]
            if (chapRegex.includes('-')) chapRegex = chapRegex.replace('-', '.')
            chapNum = Number(chapRegex)
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

export const parseChapterDetails = async ($: CheerioStatic, mangaId: string, chapterId: string, cheerio: CheerioAPI, requestManager: RequestManager): Promise<ChapterDetails> => {
    const pages: string[] = []

    const scriptRegex = decodeHTMLEntity($.html()).match(/loaadchppa\('([\w\d]+)'\)/)

    let loadMoreId = ''
    if (scriptRegex && scriptRegex[1]) {
        loadMoreId = scriptRegex[1].toString()
    }

    function parseImages(_$: CheerioStatic) {
        for (const img of _$('img.imgholder').toArray()) {
            let image = _$(img).attr('src') ?? ''
            if (!image) image = _$(img).attr('data-src') ?? ''
            if (!image) continue
            pages.push(encodeURI(image))
        }
    }
    // Parse initial images
    parseImages($)

    // If loadMore is present, make request to load the other images
    if (loadMoreId) {
        const request = App.createRequest({
            url: `${MD_DOMAIN}/loaadchpa.php?chapter=${loadMoreId}`,
            method: 'GET'
        })

        const response = await requestManager.schedule(request, 1)
        const _$ = cheerio.load(response.data as string)

        // If script is present, parse second half
        parseImages(_$)
    }

    const chapterDetails = App.createChapterDetails({
        id: chapterId,
        mangaId: mangaId,
        pages: pages
    })
    return chapterDetails
}

export const parseHomeSections = ($: CheerioStatic, sectionCallback: (section: HomeSection) => void): void => {

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

    for (const manga of $('li.novel-item', $('h3:contains(Our Translation)').parent().parent()).toArray()) {
        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('img', manga).first().attr('alt') ?? ''
        const id = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        const subtitle: string = $('p.lastChapter', manga).text().trim() ?? ''

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
    for (const manga of $('li.novel-item', $('h3:contains(New Manga!)').parent().parent()).toArray()) {
        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('h4.novel-title', manga).text().trim() ?? ''
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
    for (const manga of $('li.novel-item', $('h3:contains(Most Viewed Today)').parent().parent()).toArray()) {
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
    for (const manga of $('.holder.boxsizing').toArray()) {
        const image: string = $('img', manga).first().attr('src') ?? ''
        const title: string = $('img', manga).first().attr('alt') ?? ''
        const id = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        const subtitle: string = $('h5.chapternumber', manga).text().replace('update', '').trim() ?? ''

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

export const parseViewMore = ($: CheerioStatic): PartialSourceManga[] => {
    const manga: PartialSourceManga[] = []
    const collectedIds: string[] = []

    for (const item of $('.holder.boxsizing').toArray()) {
        const image: string = $('img', item).first().attr('src') ?? ''
        const title: string = $('img', item).first().attr('alt') ?? ''
        const id = $('a', item).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
        const subtitle: string = $('h5.chapternumber', item).text().replace('update', '').trim() ?? ''

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

export const parseTags = ($: CheerioStatic): TagSection[] => {
    const arrayTags: Tag[] = []
    for (const tag of $('li.novel-item', 'form.nomarginandpadding').toArray()) {
        const label = $(tag).text().trim()
        const id = $('input.genrespick', tag).attr('value')

        if (!id || !label) continue

        arrayTags.push({ id: id, label: label })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]
    return tagSections
}

export const parseSearch = ($: CheerioStatic, isTagSearch: boolean): PartialSourceManga[] => {
    const mangas: PartialSourceManga[] = []

    if (isTagSearch) {
        for (const manga of $('.holder.boxsizing').toArray()) {
            const image: string = $('img', manga).first().attr('src') ?? ''
            const title: string = $('img', manga).first().attr('alt') ?? ''
            const id = $('a', manga).attr('href')?.replace(/\/$/, '')?.split('/').pop() ?? ''
            const subtitle: string = $('h5.chapternumber', manga).text().replace('update', '').trim() ?? ''

            if (!id || !title) continue
            mangas.push(App.createPartialSourceManga({
                image: encodeURI(image),
                title: decodeHTMLEntity(title),
                mangaId: id,
                subtitle: decodeHTMLEntity(subtitle)
            }))
        }
    } else {

        for (const obj of $('.boxsizing').toArray()) {
            const imageDomain = 'https://readermc.org'

            const title: string = $(obj).text().trim() ?? ''
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

const decodeHTMLEntity = (str: string): string => {
    return entities.decodeHTML(str)
}
