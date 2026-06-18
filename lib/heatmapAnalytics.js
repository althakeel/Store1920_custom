export const HEATMAP_EVENT_TYPE = 'heatmap_click';

export function getHeatmapStartDate(range = 'week') {
  const now = new Date();
  const startDate = new Date(now);

  if (range === 'today') {
    startDate.setHours(0, 0, 0, 0);
    return startDate;
  }
  if (range === 'week') startDate.setDate(now.getDate() - 7);
  else if (range === 'month') startDate.setMonth(now.getMonth() - 1);
  else startDate.setMonth(now.getMonth() - 3);

  return startDate;
}

export function extractClickFromEvent(event = {}) {
  const metadata = event.context?.metadata || {};
  const viewportWidth = Number(metadata.viewportWidth || 0);
  const viewportHeight = Number(metadata.viewportHeight || 0);
  const clientX = Number(metadata.clientX ?? 0);
  const clientY = Number(metadata.clientY ?? 0);

  const xPct = Number.isFinite(Number(metadata.xPct))
    ? Number(metadata.xPct)
    : viewportWidth > 0
      ? (clientX / viewportWidth) * 100
      : 0;
  const yPct = Number.isFinite(Number(metadata.yPct))
    ? Number(metadata.yPct)
    : viewportHeight > 0
      ? (clientY / viewportHeight) * 100
      : 0;

  return {
    pagePath: event.context?.pagePath || '/',
    sessionId: event.context?.sessionId || null,
    xPct: Math.max(0, Math.min(100, xPct)),
    yPct: Math.max(0, Math.min(100, yPct)),
    viewportWidth,
    viewportHeight,
    elementTag: String(metadata.elementTag || '').toUpperCase(),
    elementText: String(metadata.elementText || '').slice(0, 80),
    elementClass: String(metadata.elementClass || '').slice(0, 120),
    createdAt: event.createdAt,
  };
}

export function aggregateHeatmapClicks(events = [], { gridSize = 20 } = {}) {
  const clicks = events.map(extractClickFromEvent);
  const sessions = new Set();
  let viewportWidthTotal = 0;
  let viewportHeightTotal = 0;
  let viewportCount = 0;
  const grid = new Map();
  const elementCounts = new Map();

  clicks.forEach((click) => {
    if (click.sessionId) sessions.add(click.sessionId);

    if (click.viewportWidth > 0 && click.viewportHeight > 0) {
      viewportWidthTotal += click.viewportWidth;
      viewportHeightTotal += click.viewportHeight;
      viewportCount += 1;
    }

    const cellX = Math.min(gridSize - 1, Math.floor((click.xPct / 100) * gridSize));
    const cellY = Math.min(gridSize - 1, Math.floor((click.yPct / 100) * gridSize));
    const cellKey = `${cellX}:${cellY}`;
    grid.set(cellKey, (grid.get(cellKey) || 0) + 1);

    const elementKey = [
      click.elementTag || 'UNKNOWN',
      click.elementText || click.elementClass || 'element',
    ].join('::');
    elementCounts.set(elementKey, (elementCounts.get(elementKey) || 0) + 1);
  });

  const density = [...grid.entries()]
    .map(([key, count]) => {
      const [cellX, cellY] = key.split(':').map(Number);
      return {
        cellX,
        cellY,
        count,
        xPct: ((cellX + 0.5) / gridSize) * 100,
        yPct: ((cellY + 0.5) / gridSize) * 100,
      };
    })
    .sort((a, b) => b.count - a.count);

  const topElements = [...elementCounts.entries()]
    .map(([key, count]) => {
      const [tag, text] = key.split('::');
      return { tag, text, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const maxDensity = density.reduce((max, cell) => Math.max(max, cell.count), 0);

  return {
    summary: {
      totalClicks: clicks.length,
      uniqueSessions: sessions.size,
      avgViewport: viewportCount
        ? {
            width: Math.round(viewportWidthTotal / viewportCount),
            height: Math.round(viewportHeightTotal / viewportCount),
          }
        : null,
    },
    density,
    maxDensity,
    points: clicks.slice(0, 500),
    topElements,
  };
}

export function aggregateHeatmapPages(events = []) {
  const pageMap = new Map();

  events.forEach((event) => {
    const pagePath = event.context?.pagePath || '/';
    pageMap.set(pagePath, (pageMap.get(pagePath) || 0) + 1);
  });

  return [...pageMap.entries()]
    .map(([pagePath, clicks]) => ({ pagePath, clicks }))
    .sort((a, b) => b.clicks - a.clicks);
}
