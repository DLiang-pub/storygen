export type StoredStoryPage = {
  title: string;
  text: string;
  image?: string;
  alt: string;
  sound?: string;
  illustrationPrompt?: string;
  illustrationStatus?: "idle" | "loading" | "ready" | "error";
  illustrationError?: string;
};

export type StoredStory = {
  version: 1;
  id: string;
  title: string;
  creationName: string;
  drawingSummary: string;
  moral?: string;
  coverImage?: string;
  drawingHint: string;
  drawingDataUrl: string;
  artToken: string;
  pageOneAnchorToken: string;
  scenario: string;
  badGuy: string | null;
  interests: string[];
  readingLevel?: "age-6" | "age-7-9";
  pages: StoredStoryPage[];
  lastPage: number;
  expiresAt: number;
  updatedAt: number;
  archivedAt?: number;
};

export type ArchivedStorySummary = {
  version: 1;
  id: string;
  title: string;
  creationName: string;
  scenario: string;
  readingLevel?: "age-6" | "age-7-9";
  pictureCount: number;
  coverImage?: string;
  archivedAt: number;
  updatedAt: number;
};

export const MAX_ARCHIVED_STORIES = 8;

const DATABASE_NAME = "storygen2-local";
const DATABASE_VERSION = 1;
const STORE_NAME = "bedtime-stories";
const CURRENT_STORY_KEY = "current";
const ARCHIVE_KEY_PREFIX = "archive:";
const ARCHIVE_SUMMARY_KEY_PREFIX = "archive-summary:";

let writeQueue: Promise<void> = Promise.resolve();

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Story storage could not be opened."));
  });
}

async function runStoreRequest<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      let result!: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error ?? new Error("Story storage request failed."));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error ?? new Error("Story storage transaction failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Story storage transaction was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function loadStoredStory() {
  if (typeof indexedDB === "undefined") return null;
  try {
    const story = await runStoreRequest<StoredStory | undefined>("readonly", (store) => store.get(CURRENT_STORY_KEY));
    if (!story || story.version !== 1 || story.expiresAt <= Date.now() || story.pages.length !== 9) {
      if (story) await clearStoredStory(story.id);
      return null;
    }
    return story;
  } catch {
    return null;
  }
}

export function saveStoredStory(story: StoredStory) {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const database = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(STORE_NAME, "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const archiveRequest = store.get(archiveKey(story.id));
          archiveRequest.onsuccess = () => {
            const currentRequest = store.get(CURRENT_STORY_KEY);
            currentRequest.onsuccess = () => {
              const current = currentRequest.result as StoredStory | undefined;
              if (archiveRequest.result) {
                // A stale tab must not recreate a current draft after it was moved to the shelf.
                if (current?.id === story.id) store.delete(CURRENT_STORY_KEY);
                return;
              }
              store.put(story, CURRENT_STORY_KEY);
            };
            currentRequest.onerror = () => reject(currentRequest.error ?? new Error("The current story could not be checked."));
          };
          archiveRequest.onerror = () => reject(archiveRequest.error ?? new Error("The story shelf could not be checked."));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error ?? new Error("The current story could not be saved."));
          transaction.onabort = () => reject(transaction.error ?? new Error("The current story save was cancelled."));
        });
      } finally {
        database.close();
      }
    });
  return writeQueue;
}

function archiveKey(storyId: string) {
  return `${ARCHIVE_KEY_PREFIX}${storyId}`;
}

function archiveSummaryKey(storyId: string) {
  return `${ARCHIVE_SUMMARY_KEY_PREFIX}${storyId}`;
}

function archiveSummaryRange() {
  return IDBKeyRange.bound(ARCHIVE_SUMMARY_KEY_PREFIX, `${ARCHIVE_SUMMARY_KEY_PREFIX}\uffff`);
}

function archiveRange() {
  return IDBKeyRange.bound(ARCHIVE_KEY_PREFIX, `${ARCHIVE_KEY_PREFIX}\uffff`);
}

function isStoredStory(value: unknown, expectedId?: string): value is StoredStory {
  if (!value || typeof value !== "object") return false;
  const story = value as Partial<StoredStory>;
  return story.version === 1
    && typeof story.id === "string"
    && story.id.length > 0
    && (!expectedId || story.id === expectedId)
    && typeof story.title === "string"
    && typeof story.creationName === "string"
    && typeof story.scenario === "string"
    && Number.isFinite(story.expiresAt)
    && Number.isFinite(story.updatedAt)
    && Array.isArray(story.pages)
    && story.pages.length === 9
    && story.pages.every((page) => Boolean(page) && typeof page === "object");
}

function isArchivedStorySummary(value: unknown): value is ArchivedStorySummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<ArchivedStorySummary>;
  return summary.version === 1
    && typeof summary.id === "string"
    && summary.id.length > 0
    && (summary.coverImage === undefined || typeof summary.coverImage === "string")
    && Number.isFinite(summary.archivedAt);
}

function createArchiveSummary(story: StoredStory, archivedAt: number): ArchivedStorySummary {
  return {
    version: 1,
    id: story.id,
    title: story.title,
    creationName: story.creationName,
    scenario: story.scenario,
    readingLevel: story.readingLevel,
    pictureCount: story.pages.filter((page) => Boolean(page.image)).length,
    coverImage: story.coverImage || story.pages[0]?.image,
    archivedAt,
    updatedAt: story.updatedAt,
  };
}

function prepareArchivedStory(story: StoredStory, archivedAt: number): StoredStory {
  const pictureCount = story.pages.filter((page) => Boolean(page.image)).length;
  const artPassExpired = story.expiresAt <= Date.now();
  const shouldScrubArtPass = pictureCount === story.pages.length || artPassExpired;
  const pages = artPassExpired
    ? story.pages.map((page) => page.image ? page : {
      ...page,
      illustrationStatus: "error" as const,
      illustrationError: "This picture wasn’t finished before its art pass ended.",
    })
    : story.pages;
  return {
    ...story,
    pages,
    archivedAt,
    drawingDataUrl: shouldScrubArtPass ? "" : story.drawingDataUrl,
    artToken: shouldScrubArtPass ? "" : story.artToken,
    pageOneAnchorToken: shouldScrubArtPass ? "" : story.pageOneAnchorToken,
  };
}

function mergeArchivedStory(existing: StoredStory, incoming: StoredStory) {
  return {
    ...incoming,
    moral: incoming.moral || existing.moral,
    coverImage: incoming.coverImage || incoming.pages[0]?.image || existing.coverImage || existing.pages[0]?.image,
    drawingDataUrl: incoming.drawingDataUrl || existing.drawingDataUrl,
    artToken: incoming.artToken || existing.artToken,
    pageOneAnchorToken: incoming.pageOneAnchorToken || existing.pageOneAnchorToken,
    pages: incoming.pages.map((page, index) => {
      const existingPage = existing.pages[index];
      if (page.image || !existingPage?.image) return page;
      return {
        ...page,
        image: existingPage.image,
        illustrationStatus: "ready" as const,
        illustrationError: undefined,
      };
    }),
    updatedAt: Math.max(existing.updatedAt, incoming.updatedAt),
  };
}

async function reconcileArchivedRecords() {
  const database = await openDatabase();
  try {
    return await new Promise<ArchivedStorySummary[]>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const summaryRecordsRequest = store.getAll(archiveSummaryRange());
      const summaryKeysRequest = store.getAllKeys(archiveSummaryRange());
      const requests = [summaryRecordsRequest, summaryKeysRequest];
      let completedRequests = 0;
      let reconciled: ArchivedStorySummary[] = [];
      let settled = false;

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
        try { transaction.abort(); } catch { /* The transaction may already be finishing. */ }
      };

      const reconcile = () => {
        const summaryRecords = summaryRecordsRequest.result as unknown[];
        const summaryKeys = summaryKeysRequest.result;
        const validSummaryById = new Map<string, ArchivedStorySummary>();
        const validStoryIds = new Set<string>();

        for (let index = 0; index < summaryRecords.length; index += 1) {
          const key = String(summaryKeys[index]);
          const summary = summaryRecords[index];
          if (isArchivedStorySummary(summary) && key === archiveSummaryKey(summary.id)) {
            validSummaryById.set(summary.id, summary);
          }
        }

        // A cursor clones at most one image-heavy story at a time. Loading every
        // archived page into one array can exhaust mobile Safari's memory.
        const archiveCursorRequest = store.openCursor(archiveRange());
        archiveCursorRequest.onsuccess = () => {
          const cursor = archiveCursorRequest.result;
          if (!cursor) {
            for (let index = 0; index < summaryRecords.length; index += 1) {
              const key = summaryKeys[index];
              const keyText = String(key);
              const storyId = keyText.startsWith(ARCHIVE_SUMMARY_KEY_PREFIX)
                ? keyText.slice(ARCHIVE_SUMMARY_KEY_PREFIX.length)
                : "";
              // A valid full record above has already queued a fresh summary at this key.
              if (!storyId || !validStoryIds.has(storyId)) store.delete(key);
            }
            reconciled = reconciled.sort((left, right) => right.archivedAt - left.archivedAt);
            return;
          }

          const key = String(cursor.key);
          const storyId = key.startsWith(ARCHIVE_KEY_PREFIX) ? key.slice(ARCHIVE_KEY_PREFIX.length) : "";
          const story = cursor.value as unknown;
          if (!storyId || !isStoredStory(story, storyId)) {
            cursor.delete();
            if (storyId) store.delete(archiveSummaryKey(storyId));
            cursor.continue();
            return;
          }

          const priorSummary = validSummaryById.get(story.id);
          const archivedAt = Number.isFinite(story.archivedAt)
            ? Number(story.archivedAt)
            : priorSummary?.archivedAt ?? Date.now();
          const preparedStory = prepareArchivedStory(story, archivedAt);
          const refreshedSummary = createArchiveSummary(preparedStory, archivedAt);
          const pagesChanged = preparedStory.pages.some((page, pageIndex) => {
            const priorPage = story.pages[pageIndex];
            return page.illustrationStatus !== priorPage.illustrationStatus
              || page.illustrationError !== priorPage.illustrationError;
          });
          if (story.archivedAt !== archivedAt
            || preparedStory.drawingDataUrl !== story.drawingDataUrl
            || preparedStory.artToken !== story.artToken
            || preparedStory.pageOneAnchorToken !== story.pageOneAnchorToken
            || pagesChanged) {
            store.put(preparedStory, archiveKey(story.id));
          }
          store.put(refreshedSummary, archiveSummaryKey(story.id));
          validStoryIds.add(story.id);
          reconciled.push(refreshedSummary);
          cursor.continue();
        };
        archiveCursorRequest.onerror = () => fail(archiveCursorRequest.error ?? new Error("The story shelf could not be checked."));
      };

      for (const request of requests) {
        request.onsuccess = () => {
          completedRequests += 1;
          if (completedRequests === requests.length) reconcile();
        };
        request.onerror = () => fail(request.error ?? new Error("The story shelf could not be checked."));
      }
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(reconciled);
      };
      transaction.onerror = () => fail(transaction.error ?? new Error("The story shelf could not be refreshed."));
      transaction.onabort = () => fail(transaction.error ?? new Error("The story shelf refresh was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function listArchivedStorySummaries() {
  if (typeof indexedDB === "undefined") return [];
  let summaries: ArchivedStorySummary[] = [];
  try {
    writeQueue = writeQueue
      .catch(() => undefined)
      .then(async () => { summaries = await reconcileArchivedRecords(); });
    await writeQueue;
    return summaries;
  } catch {
    return [];
  }
}

export async function loadArchivedStory(storyId: string) {
  if (typeof indexedDB === "undefined") return null;
  try {
    await writeQueue.catch(() => undefined);
    const story = await runStoreRequest<StoredStory | undefined>("readonly", (store) => store.get(archiveKey(storyId)));
    if (!story || story.version !== 1 || story.id !== storyId || story.pages.length !== 9) return null;
    if (story.expiresAt <= Date.now() && (story.artToken || story.drawingDataUrl || story.pages.some((page) => !page.image && page.illustrationStatus !== "error"))) {
      const summary = await saveArchivedStory(story);
      const scrubbed = await runStoreRequest<StoredStory | undefined>("readonly", (store) => store.get(archiveKey(summary.id)));
      return scrubbed ?? null;
    }
    return story;
  } catch {
    return null;
  }
}

export async function archiveStoredStory(story: StoredStory): Promise<ArchivedStorySummary> {
  if (typeof indexedDB === "undefined") throw new Error("This browser cannot save a story shelf.");
  let savedSummary: ArchivedStorySummary | null = null;
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const database = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(STORE_NAME, "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          let rejected = false;
          const fail = (error: Error) => {
            if (rejected) return;
            rejected = true;
            reject(error);
            try { transaction.abort(); } catch { /* The transaction may already be finishing. */ }
          };
          const existingRequest = store.get(archiveKey(story.id));
          existingRequest.onsuccess = () => {
            const existingValue = existingRequest.result as unknown;
            const existing = isStoredStory(existingValue, story.id) ? existingValue : null;
            const writeStory = () => {
              const currentRequest = store.get(CURRENT_STORY_KEY);
              currentRequest.onsuccess = () => {
                const current = currentRequest.result as StoredStory | undefined;
                if (current && current.id !== story.id && !existing) {
                  fail(new Error("A different in-progress story is now saved on this device."));
                  return;
                }
                const archivedAt = existing?.archivedAt ?? Date.now();
                const mergedStory = existing ? mergeArchivedStory(existing, story) : story;
                const archivedStory = prepareArchivedStory(mergedStory, archivedAt);
                savedSummary = createArchiveSummary(archivedStory, archivedAt);
                store.put(archivedStory, archiveKey(story.id));
                store.put(savedSummary, archiveSummaryKey(story.id));
                if (current?.id === story.id) store.delete(CURRENT_STORY_KEY);
              };
              currentRequest.onerror = () => fail(currentRequest.error ?? new Error("The in-progress story could not be checked."));
            };
            if (existing) {
              writeStory();
              return;
            }
            const archiveCountRequest = store.count(archiveRange());
            archiveCountRequest.onsuccess = () => {
              if (archiveCountRequest.result >= MAX_ARCHIVED_STORIES) {
                fail(new Error(`Your story shelf already has ${MAX_ARCHIVED_STORIES} stories. Remove one before saving another.`));
                return;
              }
              writeStory();
            };
            archiveCountRequest.onerror = () => fail(archiveCountRequest.error ?? new Error("The story shelf could not be counted."));
          };
          existingRequest.onerror = () => fail(existingRequest.error ?? new Error("The story shelf could not be checked."));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => fail(transaction.error ?? new Error("The story shelf could not be updated."));
          transaction.onabort = () => fail(transaction.error ?? new Error("The story shelf update was cancelled."));
        });
      } finally {
        database.close();
      }
    });
  await writeQueue;
  if (!savedSummary) throw new Error("The story could not be saved to the shelf.");
  return savedSummary as ArchivedStorySummary;
}

export async function saveArchivedStory(story: StoredStory): Promise<ArchivedStorySummary> {
  if (typeof indexedDB === "undefined") throw new Error("This browser cannot update a story shelf.");
  let savedSummary: ArchivedStorySummary | null = null;
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const database = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(STORE_NAME, "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          let rejected = false;
          const fail = (error: Error) => {
            if (rejected) return;
            rejected = true;
            reject(error);
            try { transaction.abort(); } catch { /* The transaction may already be finishing. */ }
          };
          const existingRequest = store.get(archiveKey(story.id));
          existingRequest.onsuccess = () => {
            const existing = existingRequest.result as unknown;
            if (!isStoredStory(existing, story.id)) {
              fail(new Error("This story is no longer on the story shelf."));
              return;
            }
            const archivedAt = existing.archivedAt ?? Date.now();
            const mergedStory = mergeArchivedStory(existing, story);
            const archivedStory = prepareArchivedStory(mergedStory, archivedAt);
            savedSummary = createArchiveSummary(archivedStory, archivedAt);
            store.put(archivedStory, archiveKey(story.id));
            store.put(savedSummary, archiveSummaryKey(story.id));
          };
          existingRequest.onerror = () => fail(existingRequest.error ?? new Error("The saved story could not be checked."));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => fail(transaction.error ?? new Error("The story shelf could not be updated."));
          transaction.onabort = () => fail(transaction.error ?? new Error("The story shelf update was cancelled."));
        });
      } finally {
        database.close();
      }
    });
  await writeQueue;
  if (!savedSummary) throw new Error("The story shelf could not be updated.");
  return savedSummary as ArchivedStorySummary;
}

export async function removeArchivedStory(storyId: string) {
  if (typeof indexedDB === "undefined") return false;
  let removed = false;
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const database = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(STORE_NAME, "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          store.delete(archiveKey(storyId));
          store.delete(archiveSummaryKey(storyId));
          transaction.oncomplete = () => { removed = true; resolve(); };
          transaction.onerror = () => reject(transaction.error ?? new Error("The story could not be removed from the shelf."));
          transaction.onabort = () => reject(transaction.error ?? new Error("The story removal was cancelled."));
        });
      } finally {
        database.close();
      }
    });
  try {
    await writeQueue;
    return removed;
  } catch {
    return false;
  }
}

export async function clearStoredStory(expectedStoryId?: string) {
  if (typeof indexedDB === "undefined") return false;
  let deleted = false;
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const database = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(STORE_NAME, "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(CURRENT_STORY_KEY);
          request.onsuccess = () => {
            const current = request.result as StoredStory | undefined;
            if (!current || (expectedStoryId && current.id !== expectedStoryId)) return;
            const deleteRequest = store.delete(CURRENT_STORY_KEY);
            deleteRequest.onsuccess = () => { deleted = true; };
          };
          request.onerror = () => reject(request.error ?? new Error("Saved story could not be checked."));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error ?? new Error("Saved story could not be cleared."));
          transaction.onabort = () => reject(transaction.error ?? new Error("Saved story clear was cancelled."));
        });
      } finally {
        database.close();
      }
    });
  try {
    await writeQueue;
    return deleted;
  } catch {
    // Device-local persistence is a convenience; the live story remains usable.
    return false;
  }
}
