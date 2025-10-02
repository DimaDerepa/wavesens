#!/usr/bin/env python3
"""
Wave Analysis using DSPy + Claude Sonnet - БЛОК 2
"""
import dspy
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class WaveAnalysisSignature(dspy.Signature):
    """Анализ волновых эффектов новости"""

    # Входные данные
    headline = dspy.InputField(desc="Заголовок новости")
    summary = dspy.InputField(desc="Краткое содержание новости")
    news_age_minutes = dspy.InputField(desc="Возраст новости в минутах")
    market_status = dspy.InputField(desc="Статус рынка: open/closed/weekend/pre_market/after_hours")
    wave_status = dspy.InputField(desc="Статус волн: missed/ongoing/upcoming для каждой волны 0-6")

    # Выходные данные
    optimal_wave = dspy.OutputField(desc="Номер оптимальной волны (0-10)")
    wave_reasoning = dspy.OutputField(desc="Почему именно эта волна оптимальна")
    news_type = dspy.OutputField(desc="Тип новости: earnings/macro/regulatory/tech/crypto/other")
    market_impact = dspy.OutputField(desc="Ожидаемое влияние на рынок: high/medium/low")

class SignalGenerationSignature(dspy.Signature):
    """Generate trading signals for optimal Elliott Wave with deep market analysis.

    CRITICAL INSTRUCTIONS:
    1. Analyze both BULLISH and BEARISH implications of the news
    2. Use SHORT signals when news is NEGATIVE for a company/sector
    3. Use BUY signals when news is POSITIVE for a company/sector
    4. Consider:
       - Direct impact on mentioned companies
       - Indirect impact on competitors/suppliers
       - Sector-wide effects
       - Market sentiment shifts
    5. Be selective - only high-conviction trades with clear rationale
    6. Confidence should reflect realistic probabilities (40-80% typical range)
    """

    # Входные данные
    headline = dspy.InputField(desc="News headline")
    summary = dspy.InputField(desc="News summary with key details")
    optimal_wave = dspy.InputField(desc="Optimal Elliott Wave number (0-6)")
    wave_start_minutes = dspy.InputField(desc="Wave start in minutes from now")
    wave_end_minutes = dspy.InputField(desc="Wave end in minutes from now")
    news_type = dspy.InputField(desc="News type: earnings/macro/regulatory/tech/crypto/other")

    # Выходные данные
    tickers = dspy.OutputField(desc="List of stock tickers comma-separated (max 5, US markets only)")
    actions = dspy.OutputField(desc="Actions: BUY for positive impact, SHORT for negative impact, comma-separated. MUST analyze both directions.")
    expected_moves = dspy.OutputField(desc="Expected price moves in percent (absolute values, e.g. 2.5, 3.0), comma-separated")
    confidences = dspy.OutputField(desc="Confidence 0-100 for each trade (realistic: 40-80), comma-separated as integers")
    reasoning = dspy.OutputField(desc="Detailed reasoning for each ticker: why this direction, what catalysts, what risks")

class WaveAnalyzer:
    def __init__(self, openrouter_api_key, model_name, temperature, max_tokens, timeout):
        # Настройка OpenRouter через DSPy (правильный способ)
        import os
        os.environ['OPENROUTER_API_KEY'] = openrouter_api_key

        self.lm = dspy.LM(
            model=f"openrouter/{model_name}",
            temperature=temperature,
            max_tokens=max_tokens
        )
        dspy.settings.configure(lm=self.lm)

        self.wave_predictor = dspy.ChainOfThought(WaveAnalysisSignature)
        self.signal_predictor = dspy.ChainOfThought(SignalGenerationSignature)

    def analyze_waves(self, news_data, wave_status, market_status):
        """Анализирует волны и определяет оптимальную"""
        try:
            # Подготавливаем данные о статусе волн
            wave_status_str = self._format_wave_status(wave_status)

            logger.debug(f"Analyzing waves for news: {news_data['headline'][:50]}...")
            logger.debug(f"News age: {news_data['age_minutes']} minutes")
            logger.debug(f"Market status: {market_status}")

            response = self.wave_predictor(
                headline=news_data['headline'],
                summary=news_data['summary'],
                news_age_minutes=str(news_data['age_minutes']),
                market_status=market_status,
                wave_status=wave_status_str
            )

            # Парсим ответ
            optimal_wave = int(response.optimal_wave)
            optimal_wave = max(0, min(10, optimal_wave))  # Ограничиваем 0-10

            result = {
                'optimal_wave': optimal_wave,
                'wave_reasoning': response.wave_reasoning,
                'news_type': response.news_type,
                'market_impact': response.market_impact
            }

            logger.info(f"Wave analysis complete:")
            logger.info(f"  Optimal wave: {optimal_wave}")
            logger.info(f"  News type: {response.news_type}")
            logger.info(f"  Market impact: {response.market_impact}")
            logger.info(f"  Reasoning: {response.wave_reasoning[:100]}...")

            return result

        except Exception as e:
            logger.error(f"Wave analysis failed: {e}")
            # Fallback: выбираем волну на основе возраста новости
            fallback_wave = self._fallback_wave_selection(news_data['age_minutes'])
            return {
                'optimal_wave': fallback_wave,
                'wave_reasoning': f"Fallback due to LLM error: {str(e)}",
                'news_type': 'unknown',
                'market_impact': 'medium'
            }

    def generate_signals(self, news_data, wave_info):
        """Генерирует торговые сигналы для оптимальной волны"""
        try:
            optimal_wave = wave_info['optimal_wave']
            wave_start = self._calculate_wave_timing(optimal_wave)['start_minutes']
            wave_end = self._calculate_wave_timing(optimal_wave)['end_minutes']

            logger.debug(f"Generating signals for wave {optimal_wave}")
            logger.debug(f"Wave timing: {wave_start}-{wave_end} minutes from now")

            response = self.signal_predictor(
                headline=news_data['headline'],
                summary=news_data['summary'],
                optimal_wave=str(optimal_wave),
                wave_start_minutes=str(wave_start),
                wave_end_minutes=str(wave_end),
                news_type=wave_info['news_type']
            )

            # Парсим ответ
            signals = self._parse_signals(response)

            logger.info(f"Generated {len(signals)} signals:")
            for signal in signals:
                logger.info(f"  {signal['ticker']}: {signal['action']}, "
                           f"{signal['expected_move']}% expected, "
                           f"confidence {signal['confidence']}%")

            return signals

        except Exception as e:
            logger.error(f"Signal generation failed: {e}")
            return []

    def _format_wave_status(self, wave_status):
        """Форматирует статус волн для LLM"""
        status_parts = []
        for wave, info in wave_status.items():
            status_parts.append(f"Wave {wave}: {info['status']}")
            if info['status'] == 'ongoing':
                status_parts[-1] += f" ({info['time_left']} min left)"

        return ", ".join(status_parts)

    def _parse_signals(self, response):
        """Парсит ответ LLM в структурированные сигналы"""
        try:
            tickers = [t.strip().upper() for t in response.tickers.split(',')]
            actions = [a.strip().upper() for a in response.actions.split(',')]
            moves = [float(m.strip().replace('%', '')) for m in response.expected_moves.split(',')]
            confidences = [int(c.strip().replace('%', '')) for c in response.confidences.split(',')]

            signals = []
            min_length = min(len(tickers), len(actions), len(moves), len(confidences))

            for i in range(min_length):
                if actions[i] in ['BUY', 'SHORT']:
                    signals.append({
                        'ticker': tickers[i],
                        'action': actions[i],
                        'expected_move': abs(moves[i]),  # Всегда положительное значение
                        'confidence': max(0, min(100, confidences[i])),
                        'reasoning': response.reasoning
                    })

            return signals

        except Exception as e:
            logger.error(f"Failed to parse signals: {e}")
            return []

    def _fallback_wave_selection(self, age_minutes):
        """Fallback логика выбора волны"""
        if age_minutes < 5:
            return 0
        elif age_minutes < 30:
            return 1
        elif age_minutes < 120:
            return 2
        elif age_minutes < 360:
            return 3
        elif age_minutes < 1440:
            return 4
        elif age_minutes < 4320:
            return 5
        else:
            return 6

    def _calculate_wave_timing(self, wave):
        """Рассчитывает временные рамки волны"""
        wave_intervals = {
            0: (0, 5),
            1: (5, 30),
            2: (30, 120),
            3: (120, 360),
            4: (360, 1440),
            5: (1440, 4320),
            6: (4320, 10080),
        }

        start_min, end_min = wave_intervals.get(wave, (0, 1440))
        return {
            'start_minutes': start_min,
            'end_minutes': end_min
        }