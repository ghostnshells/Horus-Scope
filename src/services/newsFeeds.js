// Security News Feed Service
// Aggregates RSS feeds from reputable security news sources

// RSS to JSON API (free tier: 10,000 requests/day)
const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';

// Security news sources with their RSS feeds
export const NEWS_SOURCES = [
    {
        id: 'bleepingcomputer',
        name: 'BleepingComputer',
        url: 'https://www.bleepingcomputer.com/feed/',
        logo: 'https://www.bleepingcomputer.com/favicon.ico',
        color: '#0066cc'
    },
    {
        id: 'krebsonsecurity',
        name: 'Krebs on Security',
        url: 'https://krebsonsecurity.com/feed/',
        logo: 'https://krebsonsecurity.com/favicon.ico',
        color: '#c41e3a'
    },
    {
        id: 'thehackernews',
        name: 'The Hacker News',
        url: 'https://feeds.feedburner.com/TheHackersNews',
        logo: 'https://thehackernews.com/favicon.ico',
        color: '#00b894'
    },
    {
        id: 'securityweek',
        name: 'Security Week',
        url: 'https://feeds.feedburner.com/securityweek',
        logo: 'https://www.securityweek.com/favicon.ico',
        color: '#e74c3c'
    },
    {
        id: 'darkreading',
        name: 'Dark Reading',
        url: 'https://www.darkreading.com/rss.xml',
        logo: 'https://www.darkreading.com/favicon.ico',
        color: '#2c3e50'
    },
    {
        id: 'cyberscoop',
        name: 'CyberScoop',
        url: 'https://cyberscoop.com/feed/',
        logo: 'https://cyberscoop.com/favicon.ico',
        color: '#3498db'
    },
    {
        id: 'securityaffairs',
        name: 'Security Affairs',
        url: 'https://securityaffairs.com/feed',
        logo: 'https://securityaffairs.com/favicon.ico',
        color: '#9b59b6'
    },
    {
        id: 'itsecurityguru',
        name: 'IT Security Guru',
        url: 'https://www.itsecurityguru.org/feed/',
        logo: 'https://www.itsecurityguru.org/favicon.ico',
        color: '#f39c12'
    },
    {
        id: 'zdnet',
        name: 'ZDNet Security',
        url: 'https://www.zdnet.com/topic/security/rss.xml',
        logo: 'https://www.zdnet.com/favicon.ico',
        color: '#e91e63'
    },
    {
        id: 'threatpost',
        name: 'Threatpost',
        url: 'https://threatpost.com/feed/',
        logo: 'https://threatpost.com/favicon.ico',
        color: '#d32f2f'
    }
];

// Cache configuration
const CACHE_KEY = 'horus_scope_news_cache';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Get cached news data
 */
const getCachedNews = () => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_DURATION) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
        // Convert pubDate strings back to Date objects and ensure timestamp exists
        return data.map(item => {
            const pubDate = new Date(item.pubDate);
            return {
                ...item,
                pubDate: pubDate,
                pubDateTimestamp: item.pubDateTimestamp || pubDate.getTime()
            };
        });
    } catch {
        return null;
    }
};

/**
 * Save news to cache
 */
const setCachedNews = (data) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data
        }));
    } catch (error) {
        console.warn('Failed to cache news:', error);
    }
};

/**
 * Fetch RSS feed from a single source
 * @param {Object} source - Source configuration
 * @returns {Promise<Array>} Array of news items
 */
const fetchFeed = async (source) => {
    try {
        const url = `${RSS2JSON_API}?rss_url=${encodeURIComponent(source.url)}`;
        console.log(`[NewsFeed] Fetching ${source.name}...`);

        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[NewsFeed] ${source.name} HTTP error: ${response.status}`);
            throw new Error(`Failed to fetch ${source.name}`);
        }

        const data = await response.json();

        if (data.status !== 'ok' || !data.items) {
            console.warn(`[NewsFeed] ${source.name} returned status: ${data.status}, message: ${data.message || 'no items'}`);
            return [];
        }

        console.log(`[NewsFeed] ${source.name}: got ${data.items.length} articles`);

        return data.items.map(item => {
            // Parse the publication date carefully
            let pubDate = new Date(item.pubDate);

            // If parsing failed, try alternative formats or use current time
            if (isNaN(pubDate.getTime())) {
                pubDate = new Date(); // Fallback to now if date is invalid
            }

            return {
                id: `${source.id}-${item.guid || item.link}`,
                title: item.title,
                description: stripHtml(item.description || item.content || ''),
                content: item.content || item.description || '',
                link: item.link,
                pubDate: pubDate,
                pubDateTimestamp: pubDate.getTime(), // Store timestamp for reliable sorting
                author: item.author || source.name,
                thumbnail: item.thumbnail || item.enclosure?.link || extractImage(item.content),
                source: {
                    id: source.id,
                    name: source.name,
                    logo: source.logo,
                    color: source.color
                }
            };
        });
    } catch (error) {
        console.warn(`Error fetching ${source.name}:`, error);
        return [];
    }
};

/**
 * Strip HTML tags from text
 */
const stripHtml = (html) => {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim()
        .substring(0, 300);
};

/**
 * Extract first image from HTML content
 */
const extractImage = (html) => {
    if (!html) return null;
    const match = html.match(/<img[^>]+src="([^">]+)"/);
    return match ? match[1] : null;
};

/**
 * Fetch all news feeds
 * @param {boolean} forceRefresh - Bypass cache
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array>} Combined and sorted news items
 */
export const fetchAllNews = async (forceRefresh = false, onProgress = null) => {
    // Check cache first
    if (!forceRefresh) {
        const cached = getCachedNews();
        if (cached) {
            console.log('Using cached news data');
            return cached;
        }
    }

    console.log('Fetching fresh news from RSS feeds...');
    const allNews = [];

    for (let i = 0; i < NEWS_SOURCES.length; i++) {
        const source = NEWS_SOURCES[i];

        if (onProgress) {
            onProgress(i, NEWS_SOURCES.length, source.name);
        }

        const items = await fetchFeed(source);
        allNews.push(...items);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Filter out items with invalid dates, sort by date (newest first), and deduplicate
    const sortedNews = allNews
        .filter(item => item.pubDateTimestamp && !isNaN(item.pubDateTimestamp))
        .sort((a, b) => b.pubDateTimestamp - a.pubDateTimestamp)
        .filter((item, index, self) =>
            index === self.findIndex(t => t.link === item.link)
        );

    // Cache the results
    setCachedNews(sortedNews);

    console.log(`Fetched ${sortedNews.length} news items from ${NEWS_SOURCES.length} sources`);
    return sortedNews;
};

/**
 * Clear news cache
 */
export const clearNewsCache = () => {
    localStorage.removeItem(CACHE_KEY);
};

/**
 * Get news from a specific source
 */
export const getNewsBySource = (allNews, sourceId) => {
    return allNews.filter(item => item.source.id === sourceId);
};

/**
 * Search news by keyword
 */
export const searchNews = (allNews, keyword) => {
    const lower = keyword.toLowerCase();
    return allNews.filter(item =>
        item.title.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower)
    );
};

export default {
    NEWS_SOURCES,
    fetchAllNews,
    clearNewsCache,
    getNewsBySource,
    searchNews
};
