// __tests__/helpers.test.js
// Tests for critical helper functions from index.js

describe('Helper Functions', () => {
  describe('normalizeConvosoNote', () => {
    // Since we can't directly import from index.js without running the whole app,
    // we'll create a standalone version for testing
    function normalizeConvosoNote(text, maxLen = 255) {
      if (!text) return '';
      const singleLine = String(text).replace(/\s+/g, ' ').trim();
      if (singleLine.length <= maxLen) return singleLine;
      const ellipsis = '...';
      if (maxLen > ellipsis.length) {
        return singleLine.slice(0, maxLen - ellipsis.length) + ellipsis;
      }
      return singleLine.slice(0, maxLen);
    }

    test('should return empty string for null input', () => {
      expect(normalizeConvosoNote(null)).toBe('');
    });

    test('should return empty string for undefined input', () => {
      expect(normalizeConvosoNote(undefined)).toBe('');
    });

    test('should collapse multiple spaces into single space', () => {
      expect(normalizeConvosoNote('hello    world')).toBe('hello world');
    });

    test('should collapse newlines into single space', () => {
      expect(normalizeConvosoNote('hello\nworld')).toBe('hello world');
    });

    test('should handle mixed whitespace', () => {
      expect(normalizeConvosoNote('hello  \n\t  world')).toBe('hello world');
    });

    test('should truncate text longer than maxLen', () => {
      const longText = 'a'.repeat(300);
      const result = normalizeConvosoNote(longText, 255);
      expect(result.length).toBe(255);
      expect(result.endsWith('...')).toBe(true);
    });

    test('should not add ellipsis if text is exactly maxLen', () => {
      const text = 'a'.repeat(255);
      const result = normalizeConvosoNote(text, 255);
      expect(result.length).toBe(255);
      expect(result).toBe(text);
    });

    test('should trim leading and trailing whitespace', () => {
      expect(normalizeConvosoNote('  hello world  ')).toBe('hello world');
    });

    test('should handle empty string', () => {
      expect(normalizeConvosoNote('')).toBe('');
    });
  });

  describe('getMemberIdValue', () => {
    function getMemberIdValue(obj) {
      const v =
        obj?.member_id ?? obj?.Member_ID ?? obj?.memberId ?? obj?.memberID ?? obj?.field_2;

      if (v == null) return null;

      const str = String(v).trim();
      return str === '' ? null : str;
    }

    test('should return member_id when present', () => {
      expect(getMemberIdValue({ member_id: '12345' })).toBe('12345');
    });

    test('should return Member_ID when member_id not present', () => {
      expect(getMemberIdValue({ Member_ID: '12345' })).toBe('12345');
    });

    test('should return memberId when other fields not present', () => {
      expect(getMemberIdValue({ memberId: '12345' })).toBe('12345');
    });

    test('should return memberID as fallback', () => {
      expect(getMemberIdValue({ memberID: '12345' })).toBe('12345');
    });

    test('should return field_2 as last fallback', () => {
      expect(getMemberIdValue({ field_2: '12345' })).toBe('12345');
    });

    test('should prioritize member_id over other fields', () => {
      expect(
        getMemberIdValue({
          member_id: 'first',
          Member_ID: 'second',
          field_2: 'third',
        })
      ).toBe('first');
    });

    test('should return null for empty string', () => {
      expect(getMemberIdValue({ member_id: '' })).toBeNull();
    });

    test('should return null for whitespace-only string', () => {
      expect(getMemberIdValue({ member_id: '   ' })).toBeNull();
    });

    test('should return null when no member ID fields present', () => {
      expect(getMemberIdValue({ other_field: 'value' })).toBeNull();
    });

    test('should return null for null object', () => {
      expect(getMemberIdValue(null)).toBeNull();
    });

    test('should return null for undefined object', () => {
      expect(getMemberIdValue(undefined)).toBeNull();
    });

    test('should handle numeric member ID', () => {
      expect(getMemberIdValue({ member_id: 12345 })).toBe('12345');
    });

    test('should trim whitespace from member ID', () => {
      expect(getMemberIdValue({ member_id: '  12345  ' })).toBe('12345');
    });
  });

  describe('normalizeConvosoLead', () => {
    function getMemberIdValue(obj) {
      const v =
        obj?.member_id ?? obj?.Member_ID ?? obj?.memberId ?? obj?.memberID ?? obj?.field_2;
      if (v == null) return null;
      const str = String(v).trim();
      return str === '' ? null : str;
    }

    function normalizeConvosoLead(convosoLead) {
      if (!convosoLead) return null;
      const rawCalled = convosoLead.called_count;
      const callCount =
        rawCalled == null || rawCalled === '' ? null : Number(rawCalled);

      const memberId = getMemberIdValue(convosoLead);

      return {
        id: convosoLead.lead_id || convosoLead.id,
        list_id: convosoLead.list_id,
        first_name: convosoLead.first_name,
        last_name: convosoLead.last_name,
        phone: convosoLead.phone_number,
        phone_number: convosoLead.phone_number,
        state: convosoLead.state,
        call_count: callCount,
        member_id: memberId,
        Member_ID: convosoLead.Member_ID ?? memberId,
        field_2: convosoLead.field_2,
        raw: convosoLead,
      };
    }

    test('should normalize basic lead data', () => {
      const input = {
        lead_id: '123',
        list_id: '456',
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '+13055551234',
        state: 'FL',
        called_count: 2,
      };

      const result = normalizeConvosoLead(input);

      expect(result).toMatchObject({
        id: '123',
        list_id: '456',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+13055551234',
        phone_number: '+13055551234',
        state: 'FL',
        call_count: 2,
      });
    });

    test('should return null for null input', () => {
      expect(normalizeConvosoLead(null)).toBeNull();
    });

    test('should return null for undefined input', () => {
      expect(normalizeConvosoLead(undefined)).toBeNull();
    });

    test('should handle missing called_count', () => {
      const input = {
        lead_id: '123',
        phone_number: '+13055551234',
      };

      const result = normalizeConvosoLead(input);
      expect(result.call_count).toBeNull();
    });

    test('should convert called_count string to number', () => {
      const input = {
        lead_id: '123',
        phone_number: '+13055551234',
        called_count: '5',
      };

      const result = normalizeConvosoLead(input);
      expect(result.call_count).toBe(5);
    });

    test('should handle empty string called_count', () => {
      const input = {
        lead_id: '123',
        phone_number: '+13055551234',
        called_count: '',
      };

      const result = normalizeConvosoLead(input);
      expect(result.call_count).toBeNull();
    });

    test('should preserve raw lead data', () => {
      const input = {
        lead_id: '123',
        phone_number: '+13055551234',
        extra_field: 'extra_value',
      };

      const result = normalizeConvosoLead(input);
      expect(result.raw).toEqual(input);
    });

    test('should extract member_id correctly', () => {
      const input = {
        lead_id: '123',
        phone_number: '+13055551234',
        member_id: 'MEM123',
      };

      const result = normalizeConvosoLead(input);
      expect(result.member_id).toBe('MEM123');
      expect(result.Member_ID).toBe('MEM123');
    });

    test('should use field_2 as member_id fallback', () => {
      const input = {
        lead_id: '123',
        phone_number: '+13055551234',
        field_2: 'FIELD2-ID',
      };

      const result = normalizeConvosoLead(input);
      expect(result.member_id).toBe('FIELD2-ID');
      expect(result.field_2).toBe('FIELD2-ID');
    });
  });
});
