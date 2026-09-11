import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { Announcement } from '../src/types';

test('single shared announcement', async t => {
  const storage = new Map<string, string>();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); }, clear: () => storage.clear(), key: index => [...storage.keys()][index] ?? null, get length() { return storage.size; } };
  const { useAppStore } = await import('../src/store/useAppStore');
  const { isAnnouncementUnread, useAnnouncementStore } = await import('../src/store/useAnnouncementStore');
  const { AnnouncementBoard, AnnouncementText } = await import('../src/components/common/AnnouncementBoard');
  let row: Announcement | null = null;
  let failWrites = false;
  let calls = 0;
  let deferRead: ((response: Response) => void) | null = null;
  let delayNextRead = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request, init) => {
    const url = new URL(typeof request === 'string' ? request : request instanceof URL ? request.href : request.url);
    assert.equal(url.origin, 'https://announcements.invalid', 'Tests must never contact a real service');
    assert.equal(url.pathname, '/rest/v1/announcements');
    calls++;
    if ((init?.method || 'GET') === 'GET') {
      if (delayNextRead) { delayNextRead = false; return new Promise(resolve => { deferRead = resolve; }); }
      return Response.json(row ? [row] : []);
    }
    assert.equal(init?.method, 'POST');
    if (failWrites) return Response.json({ code: '42501', message: 'permission denied' }, { status: 403 });
    const payload = JSON.parse(String(init?.body));
    assert.deepEqual(Object.keys(payload).sort(), ['body', 'id']);
    assert.equal(payload.id, 'team');
    assert.equal(url.searchParams.get('on_conflict'), 'id');
    row = { ...payload, updated_at: '2026-09-09T00:00:00Z' };
    return Response.json(row);
  };
  const settle = () => new Promise(resolve => setImmediate(resolve));
  try {
    await t.test('members cannot write and oversized text makes no request', async () => {
      const before = calls;
      assert.equal((await useAnnouncementStore.getState().saveAnnouncement('公告')).success, false);
      useAppStore.setState({ currentUser: { id: 'admin-test', role: 'admin', status: 'approved', username: 'test-admin', name: '測試管理員', level: '初級', created_at: '' } });
      assert.equal((await useAnnouncementStore.getState().saveAnnouncement('字'.repeat(5001))).success, false);
      assert.equal(calls, before);
    });
    await t.test('empty initial state loads without being treated as an error', async () => {
      await useAnnouncementStore.getState().fetchAnnouncements();
      assert.equal(useAnnouncementStore.getState().hasLoaded, true);
      assert.equal(useAnnouncementStore.getState().announcement, null);
      assert.equal(useAnnouncementStore.getState().error, null);
    });
    await t.test('saving and replacing text always uses the same announcement', async () => {
      assert.equal((await useAnnouncementStore.getState().saveAnnouncement('  星期三練球\n小明擔任裁判  ')).success, true);
      assert.equal(row!.body, '星期三練球\n小明擔任裁判');
      assert.equal((await useAnnouncementStore.getState().saveAnnouncement('改為星期四練球')).success, true);
      assert.equal(useAnnouncementStore.getState().announcement?.id, 'team');
      assert.equal(useAnnouncementStore.getState().announcement?.body, '改為星期四練球');
    });
    await t.test('failed saves preserve the previously published text', async () => {
      failWrites = true;
      assert.equal((await useAnnouncementStore.getState().saveAnnouncement('不應儲存')).success, false);
      assert.equal(useAnnouncementStore.getState().announcement?.body, '改為星期四練球');
      failWrites = false;
    });
    await t.test('clearing text removes it from the board; an older response cannot restore it', async () => {
      delayNextRead = true;
      const previous = structuredClone(row);
      const pending = useAnnouncementStore.getState().fetchAnnouncements();
      await settle();
      assert.ok(deferRead);
      assert.equal((await useAnnouncementStore.getState().saveAnnouncement(' \n ')).success, true);
      deferRead!(Response.json([previous]));
      await pending;
      assert.equal(useAnnouncementStore.getState().announcement?.body, '');
      const html = renderToStaticMarkup(<MemoryRouter><AnnouncementBoard /></MemoryRouter>);
      assert.ok(html.includes('目前沒有公告。'));
    });
    await t.test('full text is escaped and multiline content is not truncated', () => {
      const html = renderToStaticMarkup(<AnnouncementText body={'第一行\n<script>alert(1)</script>\n最後一行'} />);
      assert.ok(html.includes('&lt;script&gt;'));
      assert.ok(!html.includes('<script>'));
      assert.ok(html.includes('第一行\n'));
      assert.ok(html.includes('最後一行'));
      assert.ok(!html.includes('line-clamp'));
    });
    await t.test('announcement unread state is tracked separately for each user and update', () => {
      const announcement = { id: 'team', body: '新公告', updated_at: '2026-09-09T01:00:00Z' };
      assert.equal(isAnnouncementUnread(announcement, 'member-a', {}), true);
      useAppStore.getState().markAnnouncementAsViewed('member-a', announcement.updated_at);
      const viewed = useAppStore.getState().viewedAnnouncementUpdatedAtByUser;
      assert.equal(isAnnouncementUnread(announcement, 'member-a', viewed), false);
      assert.equal(isAnnouncementUnread(announcement, 'member-b', viewed), true);
      assert.equal(isAnnouncementUnread({ ...announcement, updated_at: '2026-09-09T02:00:00Z' }, 'member-a', viewed), true);
      assert.equal(isAnnouncementUnread({ ...announcement, body: '' }, 'member-a', viewed), false);
    });
    await t.test('an account reset rejects earlier network responses', async () => {
      delayNextRead = true;
      const pending = useAnnouncementStore.getState().fetchAnnouncements();
      await settle();
      useAnnouncementStore.getState().reset();
      deferRead!(Response.json([row]));
      await pending;
      assert.equal(useAnnouncementStore.getState().announcement, null);
    });
  } finally {
    globalThis.fetch = originalFetch;
    useAnnouncementStore.getState().reset();
  }
});
