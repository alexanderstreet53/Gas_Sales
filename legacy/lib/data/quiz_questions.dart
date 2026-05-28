import '../models/personality.dart';
import '../models/quiz_question.dart';

const List<QuizQuestion> kQuizQuestions = [
  QuizQuestion(
    prompt: 'A perfect Sunday morning looks like…',
    options: [
      QuizOption(label: 'Tea, journal, slow light', type: PersonalityType.dreamer),
      QuizOption(label: 'A clear plan for the week', type: PersonalityType.achiever),
      QuizOption(label: 'Long brunch with someone I love', type: PersonalityType.connector),
      QuizOption(label: 'A spontaneous trip somewhere new', type: PersonalityType.explorer),
    ],
  ),
  QuizQuestion(
    prompt: 'When something feels heavy, you usually…',
    options: [
      QuizOption(label: 'Sit with it and feel it through', type: PersonalityType.dreamer),
      QuizOption(label: 'Make a plan to move forward', type: PersonalityType.achiever),
      QuizOption(label: 'Reach out to someone who gets it', type: PersonalityType.connector),
      QuizOption(label: 'Get outside, change the scenery', type: PersonalityType.explorer),
    ],
  ),
  QuizQuestion(
    prompt: 'What lifts you the fastest?',
    options: [
      QuizOption(label: 'A song that matches the mood', type: PersonalityType.dreamer),
      QuizOption(label: 'Doing one small thing well', type: PersonalityType.achiever),
      QuizOption(label: 'A long, honest conversation', type: PersonalityType.connector),
      QuizOption(label: 'A walk somewhere unfamiliar', type: PersonalityType.explorer),
    ],
  ),
  QuizQuestion(
    prompt: 'At your best, friends would call you…',
    options: [
      QuizOption(label: 'Soulful', type: PersonalityType.dreamer),
      QuizOption(label: 'Driven', type: PersonalityType.achiever),
      QuizOption(label: 'Warm', type: PersonalityType.connector),
      QuizOption(label: 'Curious', type: PersonalityType.explorer),
    ],
  ),
  QuizQuestion(
    prompt: 'Your inner voice tends to whisper…',
    options: [
      QuizOption(label: '"What does this really mean?"', type: PersonalityType.dreamer),
      QuizOption(label: '"What\'s the next right step?"', type: PersonalityType.achiever),
      QuizOption(label: '"Is everyone okay?"', type: PersonalityType.connector),
      QuizOption(label: '"What else is out there?"', type: PersonalityType.explorer),
    ],
  ),
  QuizQuestion(
    prompt: 'A reminder you most need to hear is…',
    options: [
      QuizOption(label: 'It\'s okay to feel it all', type: PersonalityType.dreamer),
      QuizOption(label: 'You\'re already enough', type: PersonalityType.achiever),
      QuizOption(label: 'You can be cared for too', type: PersonalityType.connector),
      QuizOption(label: 'You\'re allowed to wander', type: PersonalityType.explorer),
    ],
  ),
];
