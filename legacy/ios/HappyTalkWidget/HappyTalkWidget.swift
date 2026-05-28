//
//  HappyTalkWidget.swift
//  HappyTalkWidget
//
//  iOS Home Screen widget for Happy Talk. Renders the latest quote
//  written to the shared App Group by the Flutter app via the
//  `home_widget` plugin.
//
//  Setup is documented in README.md. App Group identifier must match
//  WidgetService.appGroupId in lib/services/widget_service.dart.
//

import WidgetKit
import SwiftUI

private let appGroupId = "group.com.happytalk.shared"
private let kQuoteText = "happy_talk_quote_text"
private let kAffirmation = "happy_talk_affirmation"

private let fallbackQuote = "“Take a breath. The next minute is allowed to be different.”"
private let fallbackAffirmation = "I begin again, as often as I need."

struct HappyTalkEntry: TimelineEntry {
    let date: Date
    let quote: String
    let affirmation: String
}

struct HappyTalkProvider: TimelineProvider {
    func placeholder(in context: Context) -> HappyTalkEntry {
        HappyTalkEntry(date: Date(), quote: fallbackQuote, affirmation: fallbackAffirmation)
    }

    func getSnapshot(in context: Context, completion: @escaping (HappyTalkEntry) -> Void) {
        completion(read(now: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HappyTalkEntry>) -> Void) {
        let entry = read(now: Date())
        // Refresh hourly — content is driven by the app, but a steady
        // refresh keeps the widget honest if the user hasn't opened the
        // app for a while.
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: entry.date) ?? entry.date
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }

    private func read(now: Date) -> HappyTalkEntry {
        let defaults = UserDefaults(suiteName: appGroupId)
        let quote = defaults?.string(forKey: kQuoteText) ?? fallbackQuote
        let affirmation = defaults?.string(forKey: kAffirmation) ?? fallbackAffirmation
        return HappyTalkEntry(date: now, quote: quote, affirmation: affirmation)
    }
}

struct HappyTalkWidgetView: View {
    let entry: HappyTalkEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        ZStack {
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 1.0,    green: 0.972, blue: 0.949),
                    Color(red: 0.902,  green: 0.863, blue: 1.0),
                    Color(red: 0.839,  green: 0.910, blue: 0.823)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(alignment: .leading, spacing: 8) {
                Text("happy talk")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.4)
                    .foregroundColor(Color(red: 0.12, green: 0.10, blue: 0.18).opacity(0.55))

                Text(entry.quote)
                    .font(.system(size: family == .systemSmall ? 14 : 17,
                                  weight: .medium,
                                  design: .serif))
                    .italic()
                    .foregroundColor(Color(red: 0.12, green: 0.10, blue: 0.18))
                    .lineLimit(family == .systemSmall ? 5 : 6)
                    .minimumScaleFactor(0.85)

                if family != .systemSmall {
                    Spacer(minLength: 4)
                    Text(entry.affirmation)
                        .font(.system(size: 13, weight: .regular))
                        .foregroundColor(Color(red: 0.12, green: 0.10, blue: 0.18).opacity(0.7))
                        .lineLimit(2)
                }

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .containerBackground(for: .widget) { Color.clear }
    }
}

@main
struct HappyTalkWidget: Widget {
    let kind: String = "HappyTalkWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HappyTalkProvider()) { entry in
            HappyTalkWidgetView(entry: entry)
        }
        .configurationDisplayName("Happy Talk")
        .description("A quiet thought, on your home screen.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#Preview(as: .systemMedium) {
    HappyTalkWidget()
} timeline: {
    HappyTalkEntry(date: .now, quote: fallbackQuote, affirmation: fallbackAffirmation)
}
