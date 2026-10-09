import assert from 'node:assert/strict';
import test from 'node:test';
import { isCorrect, normalizeAnswer, scoreAttempt } from '../lib/scoring';
import { sortRanking } from '../lib/ranking';
import { searchCourses, safeHttpUrl, mapCourse } from '../lib/catalog';
import { courses } from '../data/mock';
import type { QuizQuestion } from '../lib/types';
import type { CourseRow } from '../lib/supabase/database.types';
const questions: QuizQuestion[] = [
 { id: 'one', type: 'multiple_choice', content: '?', correctAnswer: 'A', points: 2 },
 { id: 'two', type: 'true_false', content: '?', correctAnswer: 'Đúng', points: 1 },
 { id: 'three', type: 'short_answer', content: '?', correctAnswer: ['4', '4.0'], points: 0.5 },
];
test('grades all three MVP types with fractional points and multiple accepted values', () => {
 assert.equal(scoreAttempt(questions, {one: 'A', two: 'đúng', three: '4.0'}), 3.5);
 assert.equal(scoreAttempt(questions, {one: 'B', three: '4', unknown: 'A'}), 0.5);
});
test('unanswered questions cannot earn points even for an accidental empty answer key', () => {
 assert.equal(scoreAttempt(questions, {}), 0);
 assert.equal(isCorrect({...questions[0], correctAnswer: ''}, '  '), false);
});
test('short answer normalization supports canonical Unicode, case and whitespace', () => {
 assert.equal(normalizeAnswer('  ĐẠI   SỐ  '), 'đại số');
 assert.equal(isCorrect({...questions[2], correctAnswer: 'Đại số'}, 'đại   số'), true);
 assert.equal(isCorrect({...questions[2], correctAnswer: 'Đại số'}, 'dai so'), false);
});
test('ranking uses score, duration and submitted time without mutating input', () => {
 const attempts = [
  {id: 'late', score: 10, durationMs: 200, submittedAt: '2026-10-07T12:00:01Z'},
  {id: 'low', score: 9, durationMs: 1, submittedAt: '2026-10-07T12:00:00Z'},
  {id: 'early', score: 10, durationMs: 200, submittedAt: '2026-10-07T12:00:00Z'},
  {id: 'fast', score: 10, durationMs: 100, submittedAt: '2026-10-07T12:00:03Z'},
 ];
 assert.deepEqual(sortRanking(attempts).map(a=>a.id), ['fast','early','late','low']);
 assert.equal(attempts[0].id, 'late');
 assert.deepEqual(sortRanking([]), []);
});
test('course search filters Vietnamese queries with or without diacritics', () => {
 assert.equal(searchCourses(courses, 'giai tich').length, 5);
 assert.equal(searchCourses(courses, 'all').length, courses.length);
 assert.equal(searchCourses(courses, 'not found').length, 0);
});
test('external teacher links reject executable schemes', () => {
 assert.equal(safeHttpUrl('javascript:alert(1)'), undefined);
 assert.equal(safeHttpUrl('data:text/html,test'), undefined);
 assert.equal(safeHttpUrl('https://example.com'), 'https://example.com/');
});
test('database adapter preserves zero price and safely handles nullable fields', () => {
 const row: CourseRow = {id:'1', section_id:null, title:'Course', slug:'course', thumbnail_url:null,
 description:null, category:null, price:0, old_price:null, badge:null, teacher_name:null,
 teacher_link:'javascript:alert(1)', theme:'invalid', sort_order:0, is_published:true, created_at:'', updated_at:''};
 assert.equal(mapCourse(row).price, 0);
 assert.equal(mapCourse(row).theme, 'orange');
 assert.equal(mapCourse(row).teacherLink, undefined);
});
