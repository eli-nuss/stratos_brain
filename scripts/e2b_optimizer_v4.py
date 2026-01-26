#!/usr/bin/env python3
"""
E2B Parameter Optimizer v4 - Staggered Sandbox Creation

Spins up sandboxes gradually with delays to avoid rate limits.
Uses up to 20 concurrent sandboxes with 2-second stagger between creations.
"""

import os
import json
import itertools
from datetime import datetime
from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import threading

os.environ['E2B_API_KEY'] = 'e2b_4d83c9e11ba1a22183e6b605019e63d295638947'

from e2b_code_interpreter import Sandbox

OUTPUT_DIR = '/home/ubuntu/stratos_brain/data/optimization_results'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Lock for staggered creation
creation_lock = threading.Lock()
last_creation_time = [0]  # Use list to allow mutation in nested function

# Parameter grids
PARAMETER_GRIDS = {
    'oversold_bounce': {
        'entry': {
            'rsi_threshold': [25, 30, 35],
            'ma_dist_20_threshold': [-0.06, -0.08, -0.10],
        },
        'exit': {
            'target_ma_dist': [-0.01, 0, 0.01],
            'stop_atr_mult': [1.5, 2.0, 2.5],
            'time_stop_days': [10, 15, 20],
        }
    },
    'vcp_squeeze': {
        'entry': {
            'bb_width_pctile_threshold': [15, 20, 25],
            'rsi_min': [35, 40],
            'rsi_max': [70, 75],
        },
        'exit': {
            'target_pct': [0.08, 0.10, 0.12],
            'stop_atr_mult': [1.5, 2.0],
            'time_stop_days': [15, 20],
        }
    },
    'gap_up_momentum': {
        'entry': {
            'gap_pct_threshold': [0.02, 0.03, 0.04],
            'rvol_threshold': [1.5, 2.0, 2.5],
        },
        'exit': {
            'breakdown_ma_dist': [-0.02, -0.03],
            'time_stop_days': [7, 10, 15],
        }
    },
    'acceleration_turn': {
        'entry': {
            'rsi_min': [25, 30, 35],
            'rsi_max': [55, 60, 65],
        },
        'exit': {
            'target_pct': [0.06, 0.08, 0.10],
            'stop_atr_mult': [1.5, 2.0, 2.5],
            'time_stop_days': [10, 15],
        }
    },
    'trend_pullback_50ma': {
        'entry': {
            'ma_dist_50_min': [-0.04, -0.03, -0.02],
            'ma_dist_50_max': [0.02, 0.03],
            'rsi_threshold': [45, 50, 55],
        },
        'exit': {
            'breakdown_ma_dist_200': [-0.02, -0.03],
            'trailing_activation_pct': [0.12, 0.15, 0.18],
            'trailing_atr_mult': [2.5, 3.0, 3.5],
            'max_hold_days': [90, 120],
        }
    },
    'golden_cross': {
        'entry': {
            'ma_dist_50_min': [-0.02, -0.01],
            'ma_dist_50_max': [0.05, 0.07],
            'rsi_min': [45, 50],
            'rsi_max': [65, 70],
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.03, -0.04],
            'trailing_activation_pct': [0.15, 0.20],
            'trailing_atr_mult': [3.0, 3.5],
            'max_hold_days': [120, 180],
        }
    },
    'rs_breakout': {
        'entry': {
            'rsi_min': [45, 50, 55],
            'rsi_max': [65, 70, 75],
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.03, -0.04],
            'trailing_activation_pct': [0.12, 0.15],
            'trailing_atr_mult': [2.5, 3.0],
            'max_hold_days': [90, 120],
        }
    },
    'breakout_confirmed': {
        'entry': {
            'rvol_threshold': [1.2, 1.5, 1.8],
            'rsi_min': [50, 55],
            'rsi_max': [70, 75],
        },
        'exit': {
            'breakdown_ma_dist_20': [-0.03, -0.04],
            'trailing_activation_pct': [0.10, 0.12],
            'trailing_atr_mult': [2.0, 2.5],
            'max_hold_days': [60, 90],
        }
    },
}

DB_CONFIG = {
    'host': 'db.wfogbaipiqootjrsprde.supabase.co',
    'port': 5432,
    'dbname': 'postgres',
    'user': 'postgres',
    'password': 'stratosbrainpostgresdbpw'
}

SANDBOX_CODE = '''
import subprocess
subprocess.run(['pip', 'install', 'psycopg2-binary', 'pandas', 'numpy', '-q'], check=True)

import psycopg2, pandas as pd, numpy as np, json, warnings
warnings.filterwarnings('ignore')

DB = {db_config}
SETUP = "{setup_name}"
PARAMS = {param_combinations}

conn = psycopg2.connect(**DB)
cur = conn.cursor()
cur.execute("""WITH rl AS (SELECT df.asset_id, AVG(df.dollar_volume)::float dv, AVG(df.close)::float p FROM daily_features df WHERE df.date >= '2026-01-01' GROUP BY df.asset_id)
SELECT a.asset_id, a.symbol FROM assets a JOIN rl ON a.asset_id = rl.asset_id WHERE a.asset_type = 'equity' AND rl.p >= 5 AND rl.p <= 10000 AND rl.dv > 1000000 ORDER BY rl.dv DESC LIMIT 1000""")
universe = cur.fetchall()
ids = [a[0] for a in universe]

cur.execute("""SELECT df.asset_id, df.date, df.close, df.rsi_14, df.ma_dist_20, df.ma_dist_50, df.ma_dist_200, df.ma_slope_50, df.above_ma200, df.ma50_above_ma200, df.bb_width_pctile, df.rvol_20, df.gap_pct, df.accel_turn_up, df.rs_breakout, df.breakout_confirmed_up, df.atr_14
FROM daily_features df WHERE df.asset_id = ANY(%s) AND df.date >= '2024-01-02' AND df.date <= '2026-01-20' ORDER BY df.asset_id, df.date""", (ids,))
rows = cur.fetchall()
conn.close()
print(f"Loaded {len(rows)} rows for {len(universe)} assets")

cols = ['asset_id', 'date', 'close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200', 'ma_slope_50', 'above_ma200', 'ma50_above_ma200', 'bb_width_pctile', 'rvol_20', 'gap_pct', 'accel_turn_up', 'rs_breakout', 'breakout_confirmed_up', 'atr_14']
df = pd.DataFrame(rows, columns=cols)
df['date'] = pd.to_datetime(df['date'])
for c in ['close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200', 'ma_slope_50', 'bb_width_pctile', 'rvol_20', 'gap_pct', 'atr_14']:
    df[c] = pd.to_numeric(df[c], errors='coerce')

def signals(df, s, p):
    if s == 'oversold_bounce': return df[(df['rsi_14'] < p.get('rsi_threshold', 30)) & (df['ma_dist_20'] < p.get('ma_dist_20_threshold', -0.08)) & (df['above_ma200'] == True)]
    if s == 'vcp_squeeze': return df[(df['bb_width_pctile'] < p.get('bb_width_pctile_threshold', 20)) & (df['ma_dist_50'] > 0) & (df['above_ma200'] == True) & (df['rsi_14'] >= p.get('rsi_min', 40)) & (df['rsi_14'] <= p.get('rsi_max', 70))]
    if s == 'gap_up_momentum': return df[(df['gap_pct'] > p.get('gap_pct_threshold', 0.03)) & (df['rvol_20'] > p.get('rvol_threshold', 2.0)) & (df['ma_dist_20'] > 0)]
    if s == 'acceleration_turn': return df[(df['accel_turn_up'] == True) & (df['above_ma200'] == True) & (df['rsi_14'] >= p.get('rsi_min', 30)) & (df['rsi_14'] <= p.get('rsi_max', 60))]
    if s == 'trend_pullback_50ma': return df[(df['ma_dist_50'] >= p.get('ma_dist_50_min', -0.03)) & (df['ma_dist_50'] <= p.get('ma_dist_50_max', 0.02)) & (df['above_ma200'] == True) & (df['rsi_14'] < p.get('rsi_threshold', 50)) & (df['ma_slope_50'] > 0)]
    if s == 'golden_cross': return df[(df['ma50_above_ma200'] == True) & (df['ma_dist_50'] >= p.get('ma_dist_50_min', -0.02)) & (df['ma_dist_50'] <= p.get('ma_dist_50_max', 0.05)) & (df['rsi_14'] >= p.get('rsi_min', 45)) & (df['rsi_14'] <= p.get('rsi_max', 65)) & (df['ma_slope_50'] > 0)]
    if s == 'rs_breakout': return df[(df['rs_breakout'] == True) & (df['above_ma200'] == True) & (df['rsi_14'] >= p.get('rsi_min', 50)) & (df['rsi_14'] <= p.get('rsi_max', 70))]
    if s == 'breakout_confirmed': return df[(df['breakout_confirmed_up'] == True) & (df['rvol_20'] > p.get('rvol_threshold', 1.5)) & (df['rsi_14'] >= p.get('rsi_min', 50)) & (df['rsi_14'] <= p.get('rsi_max', 75))]
    return df.iloc[:0]

def sim(adf, sigs, ex):
    trades = []
    if len(sigs) == 0: return trades
    adf = adf.reset_index(drop=True)
    d2i = dict(zip(adf['date'], range(len(adf))))
    lei = -1
    for _, sig in sigs.iterrows():
        if sig['date'] not in d2i: continue
        ei = d2i[sig['date']]
        if ei <= lei: continue
        ep = float(sig['close'])
        ea = float(sig['atr_14']) if pd.notna(sig['atr_14']) else ep * 0.02
        sl = ep - ea * ex.get('stop_atr_mult', 2.0) if 'stop_atr_mult' in ex else None
        tp = ep * (1 + ex['target_pct']) if 'target_pct' in ex else None
        ts, ta, hp = None, False, ep
        mh = ex.get('max_hold_days', ex.get('time_stop_days', 60))
        xi, xp, xr = None, None, None
        for i in range(ei + 1, min(ei + mh + 1, len(adf))):
            r = adf.iloc[i]
            c = float(r['close'])
            a = float(r['atr_14']) if pd.notna(r['atr_14']) else ea
            eh, el = c + a * 0.5, c - a * 0.5
            if eh > hp: hp = eh
            if 'trailing_activation_pct' in ex and (hp - ep) / ep >= ex['trailing_activation_pct'] and not ta:
                ta = True
                ts = hp - ex.get('trailing_atr_mult', 3.0) * ea
            if ta:
                nts = hp - ex.get('trailing_atr_mult', 3.0) * ea
                if ts is None or nts > ts: ts = nts
            if sl and el <= sl: xi, xp, xr = i, sl, 'stop_loss'; break
            if ts and el <= ts: xi, xp, xr = i, ts, 'trailing_stop'; break
            if tp and eh >= tp: xi, xp, xr = i, tp, 'take_profit'; break
            if 'target_ma_dist' in ex and pd.notna(r['ma_dist_20']) and r['ma_dist_20'] >= ex['target_ma_dist']: xi, xp, xr = i, c, 'target_ma'; break
            for k, col in [('breakdown_ma_dist_200', 'ma_dist_200'), ('breakdown_ma_dist_50', 'ma_dist_50'), ('breakdown_ma_dist_20', 'ma_dist_20'), ('breakdown_ma_dist', 'ma_dist_20')]:
                if k in ex and pd.notna(r[col]) and r[col] < ex[k]: xi, xp, xr = i, c, 'breakdown_ma'; break
            if xi: break
        if xi is None: xi, xp, xr = min(ei + mh, len(adf) - 1), float(adf.iloc[min(ei + mh, len(adf) - 1)]['close']), 'time_stop'
        ret = (xp * 0.9985) / (ep * 1.0015) - 1
        trades.append({'return_pct': ret, 'hold_days': xi - ei})
        lei = xi
    return trades

def bt(s, ep, ex, df, u):
    sigs = signals(df, s, ep)
    if len(sigs) == 0: return {'trades': 0, 'win_rate': 0, 'profit_factor': 0, 'avg_return': 0, 'score': 0}
    all_t = []
    for aid, _ in u:
        adf = df[df['asset_id'] == aid]
        if len(adf) < 50: continue
        asigs = sigs[sigs['asset_id'] == aid]
        if len(asigs) == 0: continue
        all_t.extend(sim(adf, asigs, ex))
    if not all_t: return {'trades': 0, 'win_rate': 0, 'profit_factor': 0, 'avg_return': 0, 'score': 0}
    rets = [t['return_pct'] for t in all_t]
    wins = [r for r in rets if r > 0]
    losses = [r for r in rets if r <= 0]
    wr = len(wins) / len(rets) if rets else 0
    gp = sum(wins) if wins else 0
    gl = abs(sum(losses)) if losses else 0.0001
    pf = gp / gl if gl > 0 else 0
    ar = np.mean(rets) if rets else 0
    tf = min(1.0, len(all_t) / 50)
    sc = pf * np.sqrt(len(all_t)) * (1 + ar) * tf
    return {'trades': len(all_t), 'win_rate': round(wr * 100, 1), 'profit_factor': round(pf, 3), 'avg_return': round(ar * 100, 3), 'score': round(sc, 3)}

results = []
for i, (ep, ex) in enumerate(PARAMS):
    r = bt(SETUP, ep, ex, df, universe)
    r['entry_params'] = ep
    r['exit_params'] = ex
    results.append(r)
    if (i + 1) % 20 == 0:
        print(f"Progress: {i+1}/{len(PARAMS)}")

best = max([r for r in results if r['trades'] >= 30], key=lambda x: x['score'], default=None)
out = {'setup': SETUP, 'total': len(PARAMS), 'best': best, 'results': results}
print("RESULT_JSON_START")
print(json.dumps(out))
print("RESULT_JSON_END")
'''


def generate_param_combinations(setup_name: str) -> List[tuple]:
    param_grid = PARAMETER_GRIDS.get(setup_name, {})
    entry_grid = param_grid.get('entry', {})
    exit_grid = param_grid.get('exit', {})
    
    entry_keys = list(entry_grid.keys())
    exit_keys = list(exit_grid.keys())
    
    entry_combos = list(itertools.product(*[entry_grid[k] for k in entry_keys])) if entry_keys else [()]
    exit_combos = list(itertools.product(*[exit_grid[k] for k in exit_keys])) if exit_keys else [()]
    
    all_combos = []
    for entry_vals in entry_combos:
        entry_params = dict(zip(entry_keys, entry_vals)) if entry_keys else {}
        for exit_vals in exit_combos:
            exit_params = dict(zip(exit_keys, exit_vals)) if exit_keys else {}
            all_combos.append((entry_params, exit_params))
    
    return all_combos


def create_sandbox_with_stagger():
    """Create a sandbox with staggered timing to avoid rate limits"""
    with creation_lock:
        # Wait at least 2 seconds since last creation
        elapsed = time.time() - last_creation_time[0]
        if elapsed < 2.0:
            time.sleep(2.0 - elapsed)
        
        sbx = Sandbox.create()
        last_creation_time[0] = time.time()
        return sbx


def run_sandbox(setup_name: str, param_combos: List[tuple], chunk_id: int) -> Dict:
    """Run a sandbox with staggered creation"""
    try:
        print(f"[{setup_name}][{chunk_id}] Creating sandbox...")
        sbx = create_sandbox_with_stagger()
        
        code = SANDBOX_CODE.format(
            db_config=json.dumps(DB_CONFIG),
            setup_name=setup_name,
            param_combinations=json.dumps(param_combos)
        )
        
        print(f"[{setup_name}][{chunk_id}] Running {len(param_combos)} combinations...")
        result = sbx.run_code(code)
        output_text = '\n'.join(result.logs.stdout) if result.logs else ''
        
        if 'RESULT_JSON_START' in output_text and 'RESULT_JSON_END' in output_text:
            json_start = output_text.find('RESULT_JSON_START') + len('RESULT_JSON_START')
            json_end = output_text.find('RESULT_JSON_END')
            json_str = output_text[json_start:json_end].strip()
            result_data = json.loads(json_str)
            result_data['chunk_id'] = chunk_id
            
            if result_data.get('best'):
                print(f"[{setup_name}][{chunk_id}] Done - Best PF={result_data['best']['profit_factor']}, WR={result_data['best']['win_rate']}%")
            else:
                print(f"[{setup_name}][{chunk_id}] Done - No valid results")
            
            sbx.kill()
            return result_data
        else:
            stderr = '\n'.join(result.logs.stderr) if result.logs and result.logs.stderr else ''
            print(f"[{setup_name}][{chunk_id}] No JSON output")
            sbx.kill()
            return {'setup': setup_name, 'chunk_id': chunk_id, 'error': 'No JSON output', 'stderr': stderr[:500]}
    
    except Exception as e:
        print(f"[{setup_name}][{chunk_id}] Error: {str(e)[:100]}")
        return {'setup': setup_name, 'chunk_id': chunk_id, 'error': str(e)}


def main():
    print("="*60)
    print("E2B PARAMETER OPTIMIZER v4 (Staggered)")
    print("="*60)
    
    setups = list(PARAMETER_GRIDS.keys())
    
    # Calculate all work
    all_work = []
    total_combos = 0
    for setup in setups:
        combos = generate_param_combinations(setup)
        total_combos += len(combos)
        # Split into chunks of 50
        chunk_size = 50
        chunks = [combos[i:i+chunk_size] for i in range(0, len(combos), chunk_size)]
        for i, chunk in enumerate(chunks):
            all_work.append((setup, chunk, i))
        print(f"  {setup}: {len(combos)} combos -> {len(chunks)} chunks")
    
    print(f"  TOTAL: {total_combos} combinations in {len(all_work)} chunks")
    print("="*60)
    
    start_time = time.time()
    
    # Run all chunks with limited concurrency (20 at a time)
    results_by_setup = {setup: [] for setup in setups}
    
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(run_sandbox, setup, chunk, chunk_id): (setup, chunk_id) 
                   for setup, chunk, chunk_id in all_work}
        
        completed = 0
        for future in as_completed(futures):
            setup, chunk_id = futures[future]
            completed += 1
            try:
                result = future.result()
                results_by_setup[setup].append(result)
                
                # Progress update
                if completed % 5 == 0:
                    elapsed = time.time() - start_time
                    print(f"Progress: {completed}/{len(all_work)} chunks ({elapsed:.0f}s)")
            except Exception as e:
                print(f"[{setup}][{chunk_id}] Failed: {e}")
    
    total_elapsed = time.time() - start_time
    
    # Aggregate results by setup
    print("\n" + "="*60)
    print("AGGREGATING RESULTS")
    print("="*60)
    
    summary = []
    detailed_results = []
    
    for setup in setups:
        setup_results = results_by_setup[setup]
        all_param_results = []
        for r in setup_results:
            if 'results' in r:
                all_param_results.extend(r['results'])
        
        valid = [r for r in all_param_results if r.get('trades', 0) >= 30]
        best = max(valid, key=lambda x: x['score']) if valid else None
        
        setup_summary = {
            'setup': setup,
            'total_combinations': len(all_param_results),
            'valid_results': len(valid),
            'best_result': best,
            'top_10': sorted(all_param_results, key=lambda x: x.get('score', 0), reverse=True)[:10],
        }
        detailed_results.append(setup_summary)
        
        if best:
            summary.append({
                'setup': setup,
                'profit_factor': best['profit_factor'],
                'win_rate': best['win_rate'],
                'avg_return': best['avg_return'],
                'trades': best['trades'],
                'score': best['score'],
                'entry_params': best['entry_params'],
                'exit_params': best['exit_params'],
            })
        
        # Save individual setup results
        output_file = os.path.join(OUTPUT_DIR, f'{setup}_optimized.json')
        with open(output_file, 'w') as f:
            json.dump(setup_summary, f, indent=2)
    
    summary.sort(key=lambda x: x['score'], reverse=True)
    
    # Print summary
    print("\n" + "="*60)
    print("OPTIMIZATION COMPLETE")
    print("="*60)
    print(f"Total time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} min)")
    
    print("\nBEST PARAMETERS BY SETUP (ranked by score):")
    print("-"*60)
    for i, s in enumerate(summary, 1):
        print(f"\n{i}. {s['setup']}")
        print(f"   PF={s['profit_factor']}, WR={s['win_rate']}%, AvgRet={s['avg_return']}%, Trades={s['trades']}, Score={s['score']}")
        print(f"   Entry: {s['entry_params']}")
        print(f"   Exit: {s['exit_params']}")
    
    # Save aggregate
    aggregate_file = os.path.join(OUTPUT_DIR, 'all_setups_optimized.json')
    with open(aggregate_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_elapsed_seconds': round(total_elapsed, 1),
            'total_combinations': total_combos,
            'summary': summary,
            'detailed_results': detailed_results,
        }, f, indent=2)
    
    print(f"\nResults saved to {aggregate_file}")
    return summary


if __name__ == '__main__':
    main()
