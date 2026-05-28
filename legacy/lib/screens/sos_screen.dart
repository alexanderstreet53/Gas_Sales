import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/sos_quotes.dart';
import '../models/quote.dart';
import '../services/share_service.dart';
import '../theme/app_theme.dart';
import '../widgets/gradient_background.dart';
import '../widgets/primary_button.dart';

class SosScreen extends StatefulWidget {
  const SosScreen({super.key});

  @override
  State<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends State<SosScreen>
    with SingleTickerProviderStateMixin {
  static const Duration _breathCycle = Duration(milliseconds: 8000);
  static const Duration _quoteDwell = Duration(seconds: 12);

  late final AnimationController _breath;
  late final List<Quote> _pool;
  Timer? _autoTimer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _breath = AnimationController(vsync: this, duration: _breathCycle)..repeat();
    _pool = [...kSosQuotes]..shuffle();
    _scheduleNext();
  }

  void _scheduleNext() {
    _autoTimer?.cancel();
    _autoTimer = Timer(_quoteDwell, () {
      if (!mounted) return;
      setState(() => _index = (_index + 1) % _pool.length);
      _scheduleNext();
    });
  }

  void _next() {
    HapticFeedback.selectionClick();
    setState(() => _index = (_index + 1) % _pool.length);
    _scheduleNext();
  }

  Future<void> _share() async {
    final quote = _pool[_index];
    final box = context.findRenderObject() as RenderBox?;
    final origin = box != null
        ? box.localToGlobal(Offset.zero) & box.size
        : null;
    await const ShareService().share(quote, sharePositionOrigin: origin);
  }

  @override
  void dispose() {
    _autoTimer?.cancel();
    _breath.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final quote = _pool[_index];

    return Scaffold(
      body: GradientBackground(
        colors: const [
          Color(0xFFFFF8F2),
          Color(0xFFE6DCFF),
          Color(0xFFC9E1F0),
        ],
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            child: Column(
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.close_rounded),
                      tooltip: 'Close',
                    ),
                    const Spacer(),
                    Text(
                      'sos · for spirals',
                      style: text.bodyMedium?.copyWith(
                        letterSpacing: 1.6,
                        color: AppPalette.ink.withOpacity(0.55),
                        fontSize: 12,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      tooltip: 'Share',
                      onPressed: _share,
                      icon: const Icon(Icons.ios_share_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _BreathingPacer(controller: _breath),
                const SizedBox(height: 24),
                Expanded(
                  child: GestureDetector(
                    onTap: _next,
                    behavior: HitTestBehavior.opaque,
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 900),
                      switchInCurve: Curves.easeOut,
                      switchOutCurve: Curves.easeIn,
                      transitionBuilder: (child, anim) => FadeTransition(
                        opacity: anim,
                        child: SlideTransition(
                          position: Tween<Offset>(
                            begin: const Offset(0, 0.04),
                            end: Offset.zero,
                          ).animate(anim),
                          child: child,
                        ),
                      ),
                      child: _SosQuoteView(
                        key: ValueKey<int>(_index),
                        quote: quote,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: PrimaryButton(
                        label: 'I\'m okay now',
                        icon: Icons.spa_outlined,
                        onPressed: () => Navigator.of(context).maybePop(),
                      ),
                    ),
                    const SizedBox(width: 12),
                    OutlinedSoftButton(
                      label: 'Another',
                      icon: Icons.refresh_rounded,
                      onPressed: _next,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SosQuoteView extends StatelessWidget {
  const _SosQuoteView({super.key, required this.quote});

  final Quote quote;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Center(
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              quote.text,
              textAlign: TextAlign.center,
              style: text.headlineMedium?.copyWith(
                fontStyle: FontStyle.italic,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.55),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                quote.affirmation,
                textAlign: TextAlign.center,
                style: text.bodyLarge?.copyWith(
                  color: AppPalette.ink.withOpacity(0.78),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BreathingPacer extends StatelessWidget {
  const _BreathingPacer({required this.controller});

  final AnimationController controller;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SizedBox(
      height: 180,
      child: AnimatedBuilder(
        animation: controller,
        builder: (_, __) {
          final t = controller.value;
          // Smooth in/out: scale follows half-cosine.
          final phase = 0.5 - 0.5 * math.cos(t * 2 * math.pi);
          final scale = 0.55 + 0.45 * phase;
          final label = t < 0.5 ? 'breathe in' : 'breathe out';
          return Stack(
            alignment: Alignment.center,
            children: [
              Transform.scale(
                scale: scale,
                child: Container(
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const RadialGradient(
                      colors: [
                        Color(0xFFFFF1FA),
                        Color(0xFFE6DCFF),
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppPalette.accent.withOpacity(0.18),
                        blurRadius: 32,
                        spreadRadius: 4,
                      ),
                    ],
                  ),
                ),
              ),
              Text(
                label,
                style: text.titleLarge?.copyWith(
                  letterSpacing: 1.2,
                  color: AppPalette.ink.withOpacity(0.72),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
