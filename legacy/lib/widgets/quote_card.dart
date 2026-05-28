import 'package:flutter/material.dart';

import '../models/quote.dart';
import '../theme/app_theme.dart';

class QuoteCard extends StatelessWidget {
  const QuoteCard({
    super.key,
    required this.quote,
    required this.gradient,
    this.isFavorite = false,
    this.onFavorite,
    this.onCopy,
  });

  final Quote quote;
  final List<Color> gradient;
  final bool isFavorite;
  final VoidCallback? onFavorite;
  final VoidCallback? onCopy;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradient,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F1F1B2E),
            blurRadius: 30,
            offset: Offset(0, 18),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(28, 32, 28, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppPalette.ink.withOpacity(0.18),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 20),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    quote.text,
                    style: text.headlineMedium?.copyWith(
                      color: AppPalette.ink,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 8, right: 12),
                        width: 18,
                        height: 1.5,
                        color: AppPalette.ink.withOpacity(0.45),
                      ),
                      Expanded(
                        child: Text(
                          quote.affirmation,
                          style: text.bodyLarge?.copyWith(
                            color: AppPalette.ink.withOpacity(0.78),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _SoftIconButton(
                icon: isFavorite ? Icons.favorite : Icons.favorite_border,
                tooltip: isFavorite ? 'Remove from favorites' : 'Save to favorites',
                onTap: onFavorite,
              ),
              const SizedBox(width: 12),
              _SoftIconButton(
                icon: Icons.ios_share,
                tooltip: 'Copy to clipboard',
                onTap: onCopy,
              ),
              const Spacer(),
              Text(
                'happy talk',
                style: text.bodyMedium?.copyWith(
                  color: AppPalette.ink.withOpacity(0.5),
                  letterSpacing: 1.4,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SoftIconButton extends StatelessWidget {
  const _SoftIconButton({
    required this.icon,
    required this.onTap,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = Material(
      color: Colors.white.withOpacity(0.55),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, color: AppPalette.ink, size: 20),
        ),
      ),
    );

    if (tooltip == null) return button;
    return Tooltip(message: tooltip!, child: button);
  }
}
