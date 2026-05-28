import 'package:flutter_test/flutter_test.dart';

import 'package:happy_talk/models/personality.dart';
import 'package:happy_talk/services/personality_scorer.dart';

void main() {
  const scorer = PersonalityScorer();

  test('returns the most-picked personality', () {
    final picks = [
      PersonalityType.dreamer,
      PersonalityType.dreamer,
      PersonalityType.achiever,
      PersonalityType.connector,
      PersonalityType.dreamer,
      PersonalityType.explorer,
    ];
    expect(scorer.score(picks), PersonalityType.dreamer);
  });

  test('breaks ties deterministically by enum order', () {
    final picks = [
      PersonalityType.connector,
      PersonalityType.explorer,
      PersonalityType.achiever,
      PersonalityType.dreamer,
    ];
    // All equal — first enum value wins.
    expect(scorer.score(picks), PersonalityType.dreamer);
  });

  test('handles empty input by falling back to first enum', () {
    expect(scorer.score(const []), PersonalityType.dreamer);
  });
}
