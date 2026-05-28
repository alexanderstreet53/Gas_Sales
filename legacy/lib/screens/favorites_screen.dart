import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/quote.dart';
import '../services/quote_service.dart';
import '../services/share_service.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/gradient_background.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  final QuoteService _quotes = QuoteService();
  List<Quote> _saved = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final keys = await StorageService.instance.readFavorites();
    final list = <Quote>[];
    for (final text in keys) {
      final q = _quotes.findByText(text);
      if (q != null) list.add(q);
    }
    if (!mounted) return;
    setState(() {
      _saved = list;
      _loading = false;
    });
  }

  Future<void> _remove(Quote quote) async {
    HapticFeedback.lightImpact();
    final next = _saved.where((q) => q.text != quote.text).toList();
    setState(() => _saved = next);
    await StorageService.instance.writeFavorites(next.map((q) => q.text).toList());
  }

  Future<void> _share(Quote quote) async {
    HapticFeedback.selectionClick();
    final box = context.findRenderObject() as RenderBox?;
    final origin = box != null
        ? box.localToGlobal(Offset.zero) & box.size
        : null;
    await const ShareService().share(quote, sharePositionOrigin: origin);
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('saved',
                              style: text.bodyMedium?.copyWith(
                                  letterSpacing: 1.4, fontSize: 12)),
                          Text('your kept thoughts',
                              style: text.headlineSmall),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                    : _saved.isEmpty
                        ? _EmptyState()
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                            itemBuilder: (_, i) => _SavedTile(
                              quote: _saved[i],
                              onRemove: () => _remove(_saved[i]),
                              onShare: () => _share(_saved[i]),
                            ),
                            separatorBuilder: (_, __) => const SizedBox(height: 14),
                            itemCount: _saved.length,
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SavedTile extends StatelessWidget {
  const _SavedTile({
    required this.quote,
    required this.onRemove,
    required this.onShare,
  });

  final Quote quote;
  final VoidCallback onRemove;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.65),
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F1F1B2E),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(22, 20, 14, 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  quote.text,
                  style: text.titleLarge?.copyWith(
                    fontStyle: FontStyle.italic,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  quote.affirmation,
                  style: text.bodyMedium,
                ),
              ],
            ),
          ),
          Column(
            children: [
              IconButton(
                tooltip: 'Send to someone',
                onPressed: onShare,
                icon: const Icon(Icons.ios_share_rounded, color: AppPalette.ink),
              ),
              IconButton(
                tooltip: 'Remove',
                onPressed: onRemove,
                icon: const Icon(Icons.favorite, color: AppPalette.accent),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('🤍', style: TextStyle(fontSize: 48, color: AppPalette.ink)),
            const SizedBox(height: 16),
            Text('Nothing saved yet', style: text.headlineSmall),
            const SizedBox(height: 8),
            Text(
              'Tap the heart on a thought you want to keep close. It will live here, just for you.',
              style: text.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
