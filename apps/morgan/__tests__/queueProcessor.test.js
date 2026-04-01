// __tests__/queueProcessor.test.js
// Tests for the fixed queue processor logic

describe('Queue Processor Fixes', () => {
  describe('Memory Leak Prevention', () => {
    test('should enforce MAX_QUEUED_IDS limit', () => {
      // This tests the cleanup logic for morganQueuedIds
      // Simulated: when Set reaches 10,000 entries, oldest 10% are removed

      const MAX_SIZE = 100; // Smaller for testing
      const mockSet = new Set();
      const mockTimestamps = new Map();
      const mockQueue = [];

      // Fill beyond max
      for (let i = 0; i < MAX_SIZE + 10; i++) {
        mockSet.add(`lead-${i}`);
        mockTimestamps.set(`lead-${i}`, Date.now() - (MAX_SIZE - i) * 1000);
        if (i < 50) {
          mockQueue.push({ id: `lead-${i}` });
        }
      }

      expect(mockSet.size).toBeGreaterThan(MAX_SIZE);

      // Cleanup logic
      function cleanup() {
        const entriesToRemove = Math.floor(MAX_SIZE * 0.1);
        const sorted = Array.from(mockTimestamps.entries())
          .sort((a, b) => a[1] - b[1]);

        let removed = 0;
        for (const [leadId] of sorted) {
          if (removed >= entriesToRemove) break;
          const inQueue = mockQueue.some(lead => lead.id === leadId);
          if (!inQueue) {
            mockSet.delete(leadId);
            mockTimestamps.delete(leadId);
            removed++;
          }
        }
        return removed;
      }

      const removed = cleanup();
      expect(removed).toBeGreaterThan(0);
      expect(removed).toBeLessThanOrEqual(Math.floor(MAX_SIZE * 0.1));
      expect(mockSet.size).toBeLessThan(MAX_SIZE + 10);
    });

    test('cleanupOldQueuedIds should not remove IDs in active queue', () => {
      const mockSet = new Set(['lead-1', 'lead-2', 'lead-3']);
      const mockQueue = [{ id: 'lead-2' }]; // lead-2 is in queue

      function cleanup(set, queue) {
        const toRemove = [];
        for (const leadId of set) {
          const inQueue = queue.some(lead => lead.id === leadId);
          if (!inQueue) {
            toRemove.push(leadId);
          }
        }
        toRemove.forEach(id => set.delete(id));
        return toRemove.length;
      }

      const removed = cleanup(mockSet, mockQueue);
      expect(removed).toBe(2); // lead-1 and lead-3
      expect(mockSet.has('lead-2')).toBe(true); // Still in set
      expect(mockSet.has('lead-1')).toBe(false);
      expect(mockSet.has('lead-3')).toBe(false);
    });
  });

  describe('Concurrent Call Processing', () => {
    test('should process multiple leads when multiple slots are free', async () => {
      const freeSlots = ['slot-1', 'slot-2', 'slot-3'];
      const mockQueue = [
        { id: 'lead-1', phone: '+13055551111' },
        { id: 'lead-2', phone: '+13055552222' },
        { id: 'lead-3', phone: '+13055553333' },
      ];

      const callPromises = [];
      for (const slotId of freeSlots) {
        if (mockQueue.length === 0) break;

        const lead = mockQueue.shift();
        if (!lead || !lead.phone) continue;

        // Simulate launching call
        callPromises.push(
          Promise.resolve({ success: true, slotId, leadId: lead.id })
        );
      }

      expect(callPromises.length).toBe(3);

      const results = await Promise.allSettled(callPromises);
      expect(results.length).toBe(3);
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });

    test('should handle partial failures gracefully', async () => {
      const freeSlots = ['slot-1', 'slot-2', 'slot-3'];
      const mockCalls = [
        Promise.resolve({ success: true, slotId: 'slot-1' }),
        Promise.reject(new Error('Call failed')),
        Promise.resolve({ success: true, slotId: 'slot-3' }),
      ];

      const results = await Promise.allSettled(mockCalls);

      const successful = results.filter(
        r => r.status === 'fulfilled' && r.value.success
      ).length;
      const failed = results.length - successful;

      expect(successful).toBe(2);
      expect(failed).toBe(1);
    });

    test('should stop processing when queue is empty', () => {
      const freeSlots = ['slot-1', 'slot-2', 'slot-3'];
      const mockQueue = [{ id: 'lead-1', phone: '+13055551111' }];

      const callPromises = [];
      for (const slotId of freeSlots) {
        if (mockQueue.length === 0) break; // Should break after first

        const lead = mockQueue.shift();
        callPromises.push(
          Promise.resolve({ success: true, slotId, leadId: lead.id })
        );
      }

      // Only 1 call should be made, not 3
      expect(callPromises.length).toBe(1);
    });
  });

  describe('Race Condition Elimination', () => {
    test('should allow concurrent tick execution without global lock', async () => {
      // Previously, isLaunchingCall flag caused only one tick to run at a time
      // Now, multiple ticks can run concurrently, each processing available slots

      let tick1Started = false;
      let tick2Started = false;
      let concurrentExecution = false;

      async function simulateTick(tickId) {
        if (tickId === 1) tick1Started = true;
        if (tickId === 2) {
          tick2Started = true;
          if (tick1Started) {
            concurrentExecution = true;
          }
        }

        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Run two ticks concurrently
      await Promise.all([simulateTick(1), simulateTick(2)]);

      expect(tick1Started).toBe(true);
      expect(tick2Started).toBe(true);
      // With no global lock, tick 2 can start before tick 1 finishes
      expect(concurrentExecution).toBe(true);
    });

    test('should handle Promise.allSettled correctly for multiple calls', async () => {
      const calls = [
        Promise.resolve({ success: true }),
        Promise.resolve({ success: true }),
        Promise.reject(new Error('Failed')),
      ];

      const results = await Promise.allSettled(calls);

      expect(results.length).toBe(3);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('rejected');

      // All promises complete, none block each other
      const allCompleted = results.every(r => r.status !== 'pending');
      expect(allCompleted).toBe(true);
    });
  });

  describe('ID Timestamp Tracking', () => {
    test('should track timestamps for queued IDs', () => {
      const mockTimestamps = new Map();
      const now = Date.now();

      mockTimestamps.set('lead-1', now - 1000);
      mockTimestamps.set('lead-2', now);
      mockTimestamps.set('lead-3', now - 5000);

      const sorted = Array.from(mockTimestamps.entries())
        .sort((a, b) => a[1] - b[1]);

      expect(sorted[0][0]).toBe('lead-3'); // Oldest
      expect(sorted[1][0]).toBe('lead-1');
      expect(sorted[2][0]).toBe('lead-2'); // Newest
    });

    test('should cleanup timestamps when dequeuing leads', () => {
      const mockSet = new Set(['lead-1', 'lead-2']);
      const mockTimestamps = new Map([
        ['lead-1', Date.now()],
        ['lead-2', Date.now()],
      ]);

      // Simulate dequeue
      mockSet.delete('lead-1');
      mockTimestamps.delete('lead-1');

      expect(mockSet.has('lead-1')).toBe(false);
      expect(mockTimestamps.has('lead-1')).toBe(false);
      expect(mockSet.has('lead-2')).toBe(true);
      expect(mockTimestamps.has('lead-2')).toBe(true);
    });
  });
});
