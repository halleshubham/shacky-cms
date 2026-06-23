export function computePublishTimestamp(
  publishDate: Date,
  articleNumber: number,
  totalArticles: number,
  publishHour = 1,
): Date {
  const minute = totalArticles + 1 - articleNumber;
  const d = new Date(publishDate);
  d.setHours(publishHour, minute, 0, 0);
  return d;
}
