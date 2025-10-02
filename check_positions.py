#!/usr/bin/env python3
"""Check real positions data to find mocking issues"""
import psycopg2
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://localhost/wavesens')

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Check closed positions
print('📊 Last 20 CLOSED positions:')
print('=' * 100)
cur.execute("""
    SELECT id, ticker, entry_price, exit_price, position_size,
           net_pnl, return_percent, exit_reason,
           entry_time, exit_time
    FROM experiments
    WHERE status = 'closed'
    ORDER BY exit_time DESC
    LIMIT 20
""")

closed_positions = cur.fetchall()
winning_positions = 0
losing_positions = 0
total_pnl = 0

for row in closed_positions:
    exp_id, ticker, entry_price, exit_price, pos_size, net_pnl, ret_pct, exit_reason, entry_time, exit_time = row

    print(f'ID {exp_id}: {ticker}')
    print(f'  Entry: ${entry_price if entry_price else 0:.2f} → Exit: ${exit_price if exit_price else 0:.2f}')
    print(f'  Position: ${pos_size if pos_size else 0:.2f}')
    print(f'  P&L: ${net_pnl if net_pnl else 0:.2f} | Return: {ret_pct if ret_pct else 0:.2f}%')
    print(f'  Reason: {exit_reason}')
    print()

    if net_pnl and net_pnl > 0:
        winning_positions += 1
    elif net_pnl and net_pnl < 0:
        losing_positions += 1

    if net_pnl:
        total_pnl += net_pnl

print(f'\n📈 Summary:')
print(f'  Total closed: {len(closed_positions)}')
print(f'  Winning: {winning_positions}')
print(f'  Losing: {losing_positions}')
print(f'  Total P&L: ${total_pnl:.2f}')
print(f'  Win rate: {winning_positions / len(closed_positions) * 100 if closed_positions else 0:.1f}%')

# Check active positions
print('\n\n🔥 ACTIVE positions:')
print('=' * 100)
cur.execute("""
    SELECT id, ticker, entry_price, position_size, shares, status,
           entry_time, max_hold_until
    FROM experiments
    WHERE status = 'active'
    ORDER BY entry_time DESC
    LIMIT 10
""")

active_positions = cur.fetchall()
for row in active_positions:
    exp_id, ticker, entry_price, pos_size, shares, status, entry_time, max_hold = row
    print(f'ID {exp_id}: {ticker} - Status: {status}')
    print(f'  Entry: ${entry_price if entry_price else 0:.2f}')
    print(f'  Position: ${pos_size if pos_size else 0:.2f} | Shares: {shares if shares else 0:.4f}')
    print(f'  Entered: {entry_time} | Max Hold: {max_hold}')
    print()

print(f'Total active: {len(active_positions)}')

# Check trading signals
print('\n\n📡 Recent TRADING SIGNALS:')
print('=' * 100)
cur.execute("""
    SELECT ts.id, ts.signal_type, ts.confidence, ts.elliott_wave,
           ts.reasoning, ts.market_conditions, ts.created_at,
           ni.headline
    FROM trading_signals ts
    JOIN news_items ni ON ts.news_item_id = ni.id
    ORDER BY ts.created_at DESC
    LIMIT 10
""")

for row in cur.fetchall():
    sig_id, sig_type, confidence, wave, reasoning, market_cond, created_at, headline = row
    print(f'Signal {sig_id}: {sig_type} | Wave: {wave} | Confidence: {confidence}%')
    print(f'  News: {headline[:80]}...')
    print(f'  Reasoning: {reasoning[:150]}...')
    print(f'  Created: {created_at}')
    print()

cur.close()
conn.close()
