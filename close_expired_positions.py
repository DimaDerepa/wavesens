#!/usr/bin/env python3
"""
Принудительно закрывает expired позиции
"""
import psycopg2
import psycopg2.extras
import os
from datetime import datetime

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:mOuDnxmRDVGwbbXRjPvCwJNvTKkqmzWv@switchyard.proxy.rlwy.net:37344/railway')

def close_expired_positions():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        # Find all expired active positions
        cur.execute("""
            SELECT id, ticker, entry_price, position_size, shares,
                   entry_time, max_hold_until, sp500_entry
            FROM experiments
            WHERE status = 'active'
            AND max_hold_until < NOW()
            ORDER BY id
        """)

        expired_positions = cur.fetchall()

        if not expired_positions:
            print("✅ No expired positions to close")
            return

        print(f"Found {len(expired_positions)} expired positions to close:")
        print()

        for pos in expired_positions:
            print(f"Closing position {pos['id']}: {pos['ticker']}")
            print(f"  Entry: ${pos['entry_price']:.2f}")
            print(f"  Size: ${pos['position_size']:.2f}")
            print(f"  Expired at: {pos['max_hold_until']}")

            # Use entry price as exit price (market is closed anyway)
            # This is a safe approximation since we can't get real prices
            exit_price = float(pos['entry_price'])

            # Calculate P&L (will be ~0 since using entry price)
            exit_value = float(pos['shares']) * exit_price
            gross_pnl = exit_value - float(pos['position_size'])
            commission = 0.01  # Minimal commission
            net_pnl = gross_pnl - commission
            return_percent = (net_pnl / float(pos['position_size'])) * 100

            # Calculate alpha (if sp500_entry exists)
            alpha = None
            if pos['sp500_entry']:
                # Assuming SPY stayed roughly same (market closed)
                sp500_return = 0
                alpha = return_percent - sp500_return

            # Close the position
            cur.execute("""
                UPDATE experiments
                SET status = 'closed',
                    exit_time = NOW(),
                    exit_price = %s,
                    gross_pnl = %s,
                    commission_paid = commission_paid + %s,
                    net_pnl = %s,
                    return_percent = %s,
                    alpha = %s,
                    exit_reason = 'max_hold_expired_manual_close'
                WHERE id = %s
            """, (
                exit_price, gross_pnl, commission,
                net_pnl, return_percent, alpha, pos['id']
            ))

            print(f"  ✅ Closed with exit price ${exit_price:.2f} (P&L: ${net_pnl:.2f})")
            print()

        conn.commit()
        print(f"✅ Successfully closed {len(expired_positions)} expired positions")

    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    close_expired_positions()
