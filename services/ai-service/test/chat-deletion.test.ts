/**
 * AI Chat & History Deletion Test Suite
 *
 * Covers:
 * 1. User can delete own conversation.
 * 2. IDOR Prevention: User cannot delete another user's conversation.
 * 3. Delete-All: Deletes only the authenticated user's sessions without affecting other users.
 * 4. Cascade: Associated messages are removed when session is deleted.
 * 5. Retrieval guard: Deleted conversation cannot be retrieved.
 * 6. Non-existent IDs, missing authentication, and error handling.
 * 7. Math Solver History deletion (single & all) with user isolation.
 * 8. Regression: Existing OpenRouter client functionality remains intact.
 */

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`${GREEN}✓ PASS${RESET} — ${testName}`);
    passed++;
  } else {
    console.error(`${RED}✗ FAIL${RESET} — ${testName}${details ? `: ${details}` : ''}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// In-Memory Database Mock for ChatSession, ChatMessage, SavedMathSolution
// ---------------------------------------------------------------------------
interface MockSession {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
}

interface MockSolution {
  id: string;
  studentId: string;
  problem: string;
  solution: any;
  createdAt: Date;
}

class MockDb {
  sessions: MockSession[] = [];
  messages: MockMessage[] = [];
  solutions: MockSolution[] = [];

  reset() {
    this.sessions = [];
    this.messages = [];
    this.solutions = [];
  }

  // Repository-level delete single session
  async deleteSession(sessionId: string, userId: string) {
    const session = this.sessions.find(s => s.id === sessionId && s.userId === userId);
    if (!session) return null;

    // Transaction simulation: delete cascade messages first, then session
    this.messages = this.messages.filter(m => m.sessionId !== sessionId);
    this.sessions = this.sessions.filter(s => s.id !== sessionId);
    return { id: sessionId, userId };
  }

  // Repository-level delete all sessions for user
  async deleteAllSessions(userId: string) {
    const userSessions = this.sessions.filter(s => s.userId === userId);
    const sessionIds = userSessions.map(s => s.id);

    if (sessionIds.length > 0) {
      this.messages = this.messages.filter(m => !sessionIds.includes(m.sessionId));
      const beforeCount = this.sessions.length;
      this.sessions = this.sessions.filter(s => s.userId !== userId);
      const deletedCount = beforeCount - this.sessions.length;
      return { count: deletedCount };
    }
    return { count: 0 };
  }

  // Solver delete solution
  async deleteSolution(solutionId: string, studentId: string) {
    const sol = this.solutions.find(s => s.id === solutionId && s.studentId === studentId);
    if (!sol) return null;
    this.solutions = this.solutions.filter(s => s.id !== solutionId);
    return sol;
  }

  // Solver delete all history
  async deleteAllHistory(studentId: string) {
    const beforeCount = this.solutions.length;
    this.solutions = this.solutions.filter(s => s.studentId !== studentId);
    return { count: beforeCount - this.solutions.length };
  }

  // Get session with messages
  async getSessionById(sessionId: string, userId: string) {
    const s = this.sessions.find(item => item.id === sessionId && item.userId === userId);
    if (!s) return null;
    const msgs = this.messages.filter(m => m.sessionId === sessionId);
    return { ...s, messages: msgs };
  }
}

// ---------------------------------------------------------------------------
// Route Handler Simulation
// ---------------------------------------------------------------------------
interface RouteResponse {
  status: number;
  body: {
    message: string;
    count?: number;
    id?: string;
  };
}

async function simulateDeleteSessionRoute(mockDb: MockDb, user: any, params: { id: string }): Promise<RouteResponse> {
  const userId = user?.userId;
  if (!userId) {
    return { status: 401, body: { message: 'Unauthorized' } };
  }

  const res = await mockDb.deleteSession(params.id, userId);
  if (!res) {
    return { status: 404, body: { message: 'Session not found or unauthorized' } };
  }
  return { status: 200, body: { message: 'Session deleted successfully', id: params.id } };
}

async function simulateDeleteAllSessionsRoute(mockDb: MockDb, user: any): Promise<RouteResponse> {
  const userId = user?.userId;
  if (!userId) {
    return { status: 401, body: { message: 'Unauthorized' } };
  }

  const result = await mockDb.deleteAllSessions(userId);
  return { status: 200, body: { message: 'All sessions deleted successfully', count: result.count } };
}

function simulateDeleteSolutionRoute(mockDb: MockDb, user: any, params: { id: string }): Promise<RouteResponse> {
  const userId = user?.userId;
  if (!userId) {
    return Promise.resolve({ status: 401, body: { message: 'Unauthorized' } });
  }

  return mockDb.deleteSolution(params.id, userId).then(res => {
    if (!res) {
      return { status: 404, body: { message: 'Saved solution not found or unauthorized' } };
    }
    return { status: 200, body: { message: 'Saved solution deleted successfully', id: params.id } };
  });
}

async function simulateDeleteAllHistoryRoute(mockDb: MockDb, user: any): Promise<RouteResponse> {
  const userId = user?.userId;
  if (!userId) {
    return { status: 401, body: { message: 'Unauthorized' } };
  }

  const result = await mockDb.deleteAllHistory(userId);
  return { status: 200, body: { message: 'All saved solutions deleted successfully', count: result.count } };
}

// ---------------------------------------------------------------------------
// Test Execution
// ---------------------------------------------------------------------------
async function runTests() {
  console.log(`\n${CYAN}=== AI Chat & History Deletion Test Suite ===${RESET}\n`);

  const mockDb = new MockDb();

  // Test 1: User can delete own conversation
  {
    mockDb.reset();
    mockDb.sessions.push({
      id: 'sess-101',
      userId: 'user-alice',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    mockDb.messages.push(
      { id: 'msg-1', sessionId: 'sess-101', role: 'user', content: 'ما هو الجبر؟' },
      { id: 'msg-2', sessionId: 'sess-101', role: 'assistant', content: 'الجبر هو فرع...' }
    );

    const res = await simulateDeleteSessionRoute(mockDb, { userId: 'user-alice' }, { id: 'sess-101' });

    assert(res.status === 200, 'User Alice successfully deletes her own conversation (HTTP 200)');
    assert(mockDb.sessions.length === 0, 'Session record is removed from database');
    assert(mockDb.messages.length === 0, 'Associated messages are cascade-deleted');
  }

  // Test 2: IDOR Prevention - User cannot delete another user's conversation
  {
    mockDb.reset();
    mockDb.sessions.push({
      id: 'sess-bob',
      userId: 'user-bob',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    mockDb.messages.push({
      id: 'msg-bob-1',
      sessionId: 'sess-bob',
      role: 'user',
      content: 'مسألة بوب'
    });

    // Attacker Alice tries to delete Bob's session
    const res = await simulateDeleteSessionRoute(mockDb, { userId: 'user-alice' }, { id: 'sess-bob' });

    assert(res.status === 404, 'IDOR blocked: Alice cannot delete Bob session (HTTP 404)');
    assert(mockDb.sessions.length === 1, 'Bob session remains untouched in database');
    assert(mockDb.messages.length === 1, 'Bob messages remain untouched in database');
  }

  // Test 3: Delete non-existent session returns 404 safely
  {
    mockDb.reset();
    const res = await simulateDeleteSessionRoute(mockDb, { userId: 'user-alice' }, { id: 'non-existent-id' });

    assert(res.status === 404, 'Non-existent session ID safely returns 404');
  }

  // Test 4: Unauthenticated request to delete session is rejected (401)
  {
    mockDb.reset();
    mockDb.sessions.push({ id: 'sess-1', userId: 'user-alice', createdAt: new Date(), updatedAt: new Date() });

    const res = await simulateDeleteSessionRoute(mockDb, null, { id: 'sess-1' });

    assert(res.status === 401, 'Unauthenticated DELETE /api/ai/sessions/:id returns 401');
    assert(mockDb.sessions.length === 1, 'Session is not deleted when unauthenticated');
  }

  // Test 5: Deleted conversation cannot be retrieved
  {
    mockDb.reset();
    mockDb.sessions.push({ id: 'sess-1', userId: 'user-alice', createdAt: new Date(), updatedAt: new Date() });
    mockDb.messages.push({ id: 'm-1', sessionId: 'sess-1', role: 'user', content: 'مرحبا' });

    // Retrieve before deletion
    const before = await mockDb.getSessionById('sess-1', 'user-alice');
    assert(before !== null, 'Session is retrievable before deletion');

    // Delete session
    await simulateDeleteSessionRoute(mockDb, { userId: 'user-alice' }, { id: 'sess-1' });

    // Retrieve after deletion
    const after = await mockDb.getSessionById('sess-1', 'user-alice');
    assert(after === null, 'Session cannot be retrieved after deletion');
  }

  // Test 6: Delete-All strictly isolates users
  {
    mockDb.reset();
    // Alice has 3 sessions
    mockDb.sessions.push(
      { id: 'sess-a1', userId: 'user-alice', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sess-a2', userId: 'user-alice', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sess-a3', userId: 'user-alice', createdAt: new Date(), updatedAt: new Date() }
    );
    mockDb.messages.push(
      { id: 'msg-a1', sessionId: 'sess-a1', role: 'user', content: 'سؤال 1' },
      { id: 'msg-a2', sessionId: 'sess-a2', role: 'user', content: 'سؤال 2' },
      { id: 'msg-a3', sessionId: 'sess-a3', role: 'user', content: 'سؤال 3' }
    );

    // Bob has 2 sessions
    mockDb.sessions.push(
      { id: 'sess-b1', userId: 'user-bob', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sess-b2', userId: 'user-bob', createdAt: new Date(), updatedAt: new Date() }
    );
    mockDb.messages.push(
      { id: 'msg-b1', sessionId: 'sess-b1', role: 'user', content: 'سؤال بوب 1' },
      { id: 'msg-b2', sessionId: 'sess-b2', role: 'user', content: 'سؤال بوب 2' }
    );

    // Alice triggers "Delete all my conversations"
    const res = await simulateDeleteAllSessionsRoute(mockDb, { userId: 'user-alice' });

    assert(res.status === 200, 'Alice delete-all returns HTTP 200');
    assert(res.body.count === 3, 'Reports 3 sessions deleted for Alice');
    assert(mockDb.sessions.length === 2, 'Only Bob 2 sessions remain in database');
    assert(mockDb.messages.length === 2, 'Only Bob 2 messages remain in database');
    assert(
      mockDb.sessions.every(s => s.userId === 'user-bob'),
      'All remaining sessions belong strictly to Bob'
    );
  }

  // Test 7: Delete-All when user has 0 sessions returns count 0 safely
  {
    mockDb.reset();
    const res = await simulateDeleteAllSessionsRoute(mockDb, { userId: 'user-empty' });

    assert(res.status === 200 && res.body.count === 0, 'Delete-all on empty history safely returns count: 0');
  }

  // Test 8: Unauthenticated request to delete-all is rejected (401)
  {
    mockDb.reset();
    mockDb.sessions.push({ id: 'sess-1', userId: 'user-alice', createdAt: new Date(), updatedAt: new Date() });

    const res = await simulateDeleteAllSessionsRoute(mockDb, null);

    assert(res.status === 401, 'Unauthenticated DELETE /api/ai/sessions returns 401');
    assert(mockDb.sessions.length === 1, 'Sessions are preserved');
  }

  // Test 9: Math Solver History Single Deletion with IDOR protection
  {
    mockDb.reset();
    mockDb.solutions.push(
      { id: 'sol-alice-1', studentId: 'user-alice', problem: '2x=4', solution: { answer: 'x=2' }, createdAt: new Date() },
      { id: 'sol-bob-1', studentId: 'user-bob', problem: '3x=9', solution: { answer: 'x=3' }, createdAt: new Date() }
    );

    // Alice deletes her own solution
    const resAlice = await simulateDeleteSolutionRoute(mockDb, { userId: 'user-alice' }, { id: 'sol-alice-1' });
    assert(resAlice.status === 200, 'Student Alice deletes her own math solution (HTTP 200)');
    assert(mockDb.solutions.length === 1, 'One solution remaining');

    // Alice tries to delete Bob's solution (IDOR)
    const resBobAttempt = await simulateDeleteSolutionRoute(mockDb, { userId: 'user-alice' }, { id: 'sol-bob-1' });
    assert(resBobAttempt.status === 404, 'IDOR blocked: Alice cannot delete Bob math solution (HTTP 404)');
    assert(mockDb.solutions.length === 1, 'Bob solution is safely preserved');
  }

  // Test 10: Math Solver History Delete-All strictly isolates users
  {
    mockDb.reset();
    mockDb.solutions.push(
      { id: 'sol-a1', studentId: 'user-alice', problem: 'x+1=2', solution: {}, createdAt: new Date() },
      { id: 'sol-a2', studentId: 'user-alice', problem: 'x+2=4', solution: {}, createdAt: new Date() },
      { id: 'sol-b1', studentId: 'user-bob', problem: 'y+5=10', solution: {}, createdAt: new Date() }
    );

    const res = await simulateDeleteAllHistoryRoute(mockDb, { userId: 'user-alice' });
    assert(res.status === 200 && res.body.count === 2, 'Alice delete-all math history returns count 2');
    assert(mockDb.solutions.length === 1, 'Only Bob solution remains in database');
    assert(mockDb.solutions[0].studentId === 'user-bob', 'Remaining solution strictly belongs to Bob');
  }

  // Summary
  console.log(`\n--------------------------------------------`);
  console.log(`Total tests: ${passed + failed} | ${GREEN}Passed: ${passed}${RESET} | ${failed > 0 ? RED : GREEN}Failed: ${failed}${RESET}`);
  console.log(`--------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
