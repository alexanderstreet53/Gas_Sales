import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../widgets/app_logo.dart';
import '../widgets/gradient_background.dart';
import '../widgets/primary_button.dart';
import 'quiz_screen.dart';
import 'splash_screen.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  static const _bullets = [
    ('🌿', 'Take a one-minute quiz', 'No right answers. No saved data leaving your phone.'),
    ('🌸', 'Get a personality match', 'Four warm types — yours flavors every reminder.'),
    ('🌤', 'Receive small, kind reminders', 'Calm, specific lines for the hard moments.'),
  ];

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;

    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, 32, 28, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const AppLogo(size: 44, showShadow: false),
                    const SizedBox(width: 12),
                    Text(
                      'happy talk',
                      style: text.bodyMedium?.copyWith(
                        letterSpacing: 1.6,
                        color: AppPalette.ink.withOpacity(0.6),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Text(
                  'a softer way\nto talk to\nyourself.',
                  style: text.displayLarge,
                ),
                const SizedBox(height: 16),
                Text(
                  'Quiet reminders, tuned to who you are. Made for spirals, anxious nights, and the loud little voice that needs softening.',
                  style: text.bodyMedium,
                ),
                const SizedBox(height: 36),
                ..._bullets.map(
                  (b) => Padding(
                    padding: const EdgeInsets.only(bottom: 18),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(b.$1, style: const TextStyle(fontSize: 24)),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(b.$2, style: text.titleLarge),
                              const SizedBox(height: 4),
                              Text(b.$3, style: text.bodyMedium),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                PrimaryButton(
                  label: 'Take the 1-minute quiz',
                  icon: Icons.arrow_forward_rounded,
                  onPressed: () {
                    Navigator.of(context).push(fadeRoute(const QuizScreen()));
                  },
                ),
                const SizedBox(height: 12),
                Center(
                  child: Text(
                    'No accounts. No tracking. Just you.',
                    style: text.bodyMedium?.copyWith(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
