import '../models/personality.dart';
import '../models/quote.dart';

const List<Quote> kQuotes = [
  // ---- Universal (no type) ----
  Quote(
    text: '"You are allowed to be a work in progress and a masterpiece at the same time."',
    affirmation: 'I am unfolding at exactly my pace.',
  ),
  Quote(
    text: '"This thought is a visitor, not a resident."',
    affirmation: 'I let thoughts pass through me without holding on.',
  ),
  Quote(
    text: '"Softness is not the opposite of strength. It is its quietest form."',
    affirmation: 'I can be gentle and steady at once.',
  ),
  Quote(
    text: '"Rest is part of the work, not a reward for it."',
    affirmation: 'I rest because I am alive, not because I earned it.',
  ),
  Quote(
    text: '"Take a breath. The next minute is allowed to be different."',
    affirmation: 'I begin again, as often as I need.',
  ),
  Quote(
    text: '"Your nervous system is doing its best with what it knows."',
    affirmation: 'I meet my body with patience, not blame.',
  ),
  Quote(
    text: '"Slow is also a direction."',
    affirmation: 'My pace is mine to choose.',
  ),
  Quote(
    text: '"You don\'t have to earn the right to feel okay."',
    affirmation: 'I am allowed ease, simply because I exist.',
  ),

  // ---- Dreamer ----
  Quote(
    text: '"The world is wide enough to hold the way you feel things."',
    affirmation: 'I trust the depth of my inner world.',
    types: {PersonalityType.dreamer},
  ),
  Quote(
    text: '"Feeling deeply is not a flaw to fix. It is a language to learn."',
    affirmation: 'My sensitivity is a kind of intelligence.',
    types: {PersonalityType.dreamer},
  ),
  Quote(
    text: '"You are allowed to take the long, scenic route through your own mind."',
    affirmation: 'I wander inward without rushing.',
    types: {PersonalityType.dreamer},
  ),
  Quote(
    text: '"Even in the quiet, something tender is being made."',
    affirmation: 'My stillness is doing real work.',
    types: {PersonalityType.dreamer},
  ),

  // ---- Achiever ----
  Quote(
    text: '"You are a person before you are a project."',
    affirmation: 'My worth is not a deliverable.',
    types: {PersonalityType.achiever},
  ),
  Quote(
    text: '"Done is kinder than perfect, and so are you."',
    affirmation: 'I let good enough be a finish line, not a failure.',
    types: {PersonalityType.achiever},
  ),
  Quote(
    text: '"You are allowed to be proud of how far you\'ve already come."',
    affirmation: 'I notice my progress before I name what\'s next.',
    types: {PersonalityType.achiever},
  ),
  Quote(
    text: '"Pause is not a loss of momentum. It\'s how momentum lasts."',
    affirmation: 'I trust the rhythm of effort and rest.',
    types: {PersonalityType.achiever},
  ),

  // ---- Connector ----
  Quote(
    text: '"The care you so easily give others is also yours to keep."',
    affirmation: 'I turn my kindness inward today.',
    types: {PersonalityType.connector},
  ),
  Quote(
    text: '"You don\'t have to hold everyone\'s weather."',
    affirmation: 'I can love people without absorbing their storms.',
    types: {PersonalityType.connector},
  ),
  Quote(
    text: '"Being needed is not the same as being known."',
    affirmation: 'I let myself be seen, not just useful.',
    types: {PersonalityType.connector},
  ),
  Quote(
    text: '"It is safe to take up the room you naturally fill."',
    affirmation: 'My presence is a gift, not an imposition.',
    types: {PersonalityType.connector},
  ),

  // ---- Explorer ----
  Quote(
    text: '"Not knowing where this leads is allowed to be exciting, not just scary."',
    affirmation: 'I make room for wonder in the unknown.',
    types: {PersonalityType.explorer},
  ),
  Quote(
    text: '"You are allowed to outgrow the version of you that got you here."',
    affirmation: 'I bless what I\'m leaving and welcome what\'s next.',
    types: {PersonalityType.explorer},
  ),
  Quote(
    text: '"Curiosity is a form of courage."',
    affirmation: 'My questions are brave, not naive.',
    types: {PersonalityType.explorer},
  ),
  Quote(
    text: '"Wandering is not the same as being lost."',
    affirmation: 'I trust the path I am quietly making.',
    types: {PersonalityType.explorer},
  ),

  // ---- Multi-type ----
  Quote(
    text: '"You don\'t have to be sure to begin."',
    affirmation: 'I take the small step without proof.',
    types: {PersonalityType.achiever, PersonalityType.explorer},
  ),
  Quote(
    text: '"Tenderness toward yourself is not weakness. It is the bravest thing in the room."',
    affirmation: 'I choose softness as a form of strength.',
    types: {PersonalityType.dreamer, PersonalityType.connector},
  ),
  Quote(
    text: '"You are allowed to want more and to love what you already have."',
    affirmation: 'I can be grateful and still be reaching.',
    types: {PersonalityType.achiever, PersonalityType.dreamer},
  ),
  Quote(
    text: '"The right people will not be tired by you."',
    affirmation: 'I am not too much. I am simply a lot of good.',
    types: {PersonalityType.connector, PersonalityType.explorer},
  ),
];
