import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/personality.dart';
import '../models/quote.dart';
import '../services/quote_service.dart';
import '../services/share_service.dart';
import '../services/storage_service.dart';
import '../services/widget_service.dart';
import '../theme/app_theme.dart';
import '../widgets/app_logo.dart';
import '../widgets/gradient_background.dart';
import '../widgets/primary_button.dart';
import '../widgets/quote_card.dart';
import 'favorites_screen.dart';
import 'sos_screen.dart';
import 'splash_screen.dart';
import 'welcome_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.personality});

  final PersonalityType personality;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final QuoteService _quotes = QuoteService();
  final PageController _controller = PageController(viewportFraction: 0.92);

  late List<Quote> _feed;
  Set<String> _favorites = {};
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _feed = _quotes.shuffledFeed(widget.personality);
    _loadFavorites();
    if (_feed.isNotEmpty) {
      WidgetService.push(_feed.first);
    }
  }

  Future<void> _loadFavorites() async {
    final saved = await StorageService.instance.readFavorites();
    if (!mounted) return;
    setState(() => _favorites = saved.toSet());
  }

  Future<void> _toggleFavorite(Quote quote) async {
    HapticFeedback.lightImpact();
    final next = _favorites.toSet();
    if (next.contains(quote.text)) {
      next.remove(quote.text);
    } else {
      next.add(quote.text);
    }
    setState(() => _favorites = next);
    await StorageService.instance.writeFavorites(next.toList());
  }

  Future<void> _shareQuote(Quote quote) async {
    HapticFeedback.selectionClick();
    final box = context.findRenderObject() as RenderBox?;
    final origin = box != null
        ? box.localToGlobal(Offset.zero) & box.size
        : null;
    final shared = await const ShareService()
        .share(quote, sharePositionOrigin: origin);
    if (!mounted || shared) return;
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppPalette.ink,
          content: Text(
            'Copied. Send it to someone soft.',
            style: TextStyle(color: AppPalette.cream),
          ),
        ),
      );
  }

  void _refreshFeed() {
    HapticFeedback.selectionClick();
    setState(() {
      _feed = _quotes.shuffledFeed(widget.personality);
      _index = 0;
    });
    if (_controller.hasClients) {
      _controller.jumpToPage(0);
    }
  }

  Future<void> _openSettings() async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppPalette.cream,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (_) => _SettingsSheet(onRetake: _retakeQuiz),
    );
  }

  Future<void> _retakeQuiz() async {
    await StorageService.instance.reset();
    if (!mounted) return;
    Navigator.of(context).pop();
    Navigator.of(context).pushAndRemoveUntil(
      fadeRoute(const WelcomeScreen()),
      (_) => false,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final personality = personalityFor(widget.personality);
    final text = Theme.of(context).textTheme;

    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 16, 8),
                child: Row(
                  children: [
                    const AppLogo(size: 36, showShadow: false),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'today · ${personality.title.toLowerCase()}',
                            style: text.bodyMedium?.copyWith(fontSize: 12, letterSpacing: 1.3),
                          ),
                          Text('a quiet thought', style: text.headlineSmall),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Saved',
                      onPressed: () {
                        Navigator.of(context).push(fadeRoute(const FavoritesScreen()));
                      },
                      icon: const Icon(Icons.favorite_border),
                    ),
                    IconButton(
                      tooltip: 'Settings',
                      onPressed: _openSettings,
                      icon: const Icon(Icons.settings_outlined),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
                child: _SosPill(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    Navigator.of(context).push(fadeRoute(const SosScreen()));
                  },
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  itemCount: _feed.length,
                  onPageChanged: (i) {
                    setState(() => _index = i);
                    WidgetService.push(_feed[i]);
                  },
                  itemBuilder: (_, i) {
                    final quote = _feed[i];
                    final saved = _favorites.contains(quote.text);
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
                      child: QuoteCard(
                        quote: quote,
                        gradient: personality.gradient,
                        isFavorite: saved,
                        onFavorite: () => _toggleFavorite(quote),
                        onCopy: () => _shareQuote(quote),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 8),
              _DotIndicator(count: _feed.length, index: _index),
              const SizedBox(height: 20),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: Row(
                  children: [
                    Expanded(
                      child: PrimaryButton(
                        label: 'Next thought',
                        icon: Icons.east_rounded,
                        onPressed: () {
                          HapticFeedback.selectionClick();
                          if (_index < _feed.length - 1) {
                            _controller.nextPage(
                              duration: const Duration(milliseconds: 320),
                              curve: Curves.easeOut,
                            );
                          } else {
                            _refreshFeed();
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    OutlinedSoftButton(
                      label: 'Reshuffle',
                      icon: Icons.refresh_rounded,
                      onPressed: _refreshFeed,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}

class _SosPill extends StatelessWidget {
  const _SosPill({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Material(
      color: Colors.white.withOpacity(0.55),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const RadialGradient(
                    colors: [Color(0xFFFFF1FA), Color(0xFFE6DCFF)],
                  ),
                ),
                child: const Icon(Icons.spa_rounded,
                    size: 18, color: AppPalette.ink),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('caught in a spiral?',
                        style: text.titleLarge?.copyWith(fontSize: 15)),
                    Text('open the calm room',
                        style: text.bodyMedium?.copyWith(fontSize: 12)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded,
                  color: AppPalette.ink.withOpacity(0.55)),
            ],
          ),
        ),
      ),
    );
  }
}

class _DotIndicator extends StatelessWidget {
  const _DotIndicator({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    final maxDots = count.clamp(0, 8);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(maxDots, (i) {
        final active = i == (index % maxDots);
        return AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          curve: Curves.easeOut,
          margin: const EdgeInsets.symmetric(horizontal: 3),
          height: 6,
          width: active ? 22 : 6,
          decoration: BoxDecoration(
            color: AppPalette.ink.withOpacity(active ? 0.85 : 0.18),
            borderRadius: BorderRadius.circular(6),
          ),
        );
      }),
    );
  }
}

class _SettingsSheet extends StatelessWidget {
  const _SettingsSheet({required this.onRetake});

  final Future<void> Function() onRetake;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(28, 20, 28, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: AppPalette.ink.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text('Settings', style: text.headlineSmall),
            const SizedBox(height: 4),
            Text(
              'Everything stays on this device.',
              style: text.bodyMedium,
            ),
            const SizedBox(height: 20),
            Material(
              color: Colors.white.withOpacity(0.6),
              borderRadius: BorderRadius.circular(20),
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () async {
                  final confirm = await showDialog<bool>(
                    context: context,
                    builder: (_) => AlertDialog(
                      backgroundColor: AppPalette.cream,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                      title: const Text('Retake the quiz?'),
                      content: const Text(
                          'This will clear your saved personality and favorites. No pressure either way.'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context, false),
                          child: const Text('Not now'),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(context, true),
                          child: const Text('Retake'),
                        ),
                      ],
                    ),
                  );
                  if (confirm == true) await onRetake();
                },
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Row(
                    children: [
                      const Icon(Icons.refresh_rounded, color: AppPalette.ink),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Retake the quiz', style: text.titleLarge),
                            const SizedBox(height: 2),
                            Text('Clears your match and favorites.',
                                style: text.bodyMedium),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded,
                          color: AppPalette.ink),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: Text(
                'made gently · v1.0',
                style: text.bodyMedium?.copyWith(fontSize: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
