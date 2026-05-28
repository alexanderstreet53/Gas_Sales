import 'package:flutter/material.dart';

enum PersonalityType { dreamer, achiever, connector, explorer }

class Personality {
  const Personality({
    required this.type,
    required this.title,
    required this.tagline,
    required this.description,
    required this.emoji,
    required this.gradient,
  });

  final PersonalityType type;
  final String title;
  final String tagline;
  final String description;
  final String emoji;
  final List<Color> gradient;
}

const Map<PersonalityType, Personality> kPersonalities = {
  PersonalityType.dreamer: Personality(
    type: PersonalityType.dreamer,
    title: 'The Dreamer',
    tagline: 'Soft soul, big imagination',
    description:
        'You feel things in colors. Your mind wanders to the gentle and the vast. '
        'Your reminders will lean lyrical — invitations to rest, to wonder, to come back to yourself.',
    emoji: '\u{1F319}',
    gradient: [Color(0xFFE6DCFF), Color(0xFFFFD9C2)],
  ),
  PersonalityType.achiever: Personality(
    type: PersonalityType.achiever,
    title: 'The Achiever',
    tagline: 'Steady fire, focused heart',
    description:
        'You move with intention. You care, deeply, about doing things well. '
        'Your reminders will help you soften the grip — proof that progress and gentleness can coexist.',
    emoji: '\u{1F31F}',
    gradient: [Color(0xFFFFF1DC), Color(0xFFFFC8B4)],
  ),
  PersonalityType.connector: Personality(
    type: PersonalityType.connector,
    title: 'The Connector',
    tagline: 'Warm heart, open arms',
    description:
        'You hold space for everyone. The world is warmer because you are in it. '
        'Your reminders will turn that same kindness back toward you, where it belongs too.',
    emoji: '\u{1F337}',
    gradient: [Color(0xFFD6E8D2), Color(0xFFC9E1F0)],
  ),
  PersonalityType.explorer: Personality(
    type: PersonalityType.explorer,
    title: 'The Explorer',
    tagline: 'Curious mind, brave feet',
    description:
        'You like the edge of the map. Newness fuels you, and so does the courage it takes. '
        'Your reminders will be small companions for the next small step.',
    emoji: '\u{1F9ED}',
    gradient: [Color(0xFFC9E1F0), Color(0xFFE6DCFF)],
  ),
};

Personality personalityFor(PersonalityType type) => kPersonalities[type]!;
