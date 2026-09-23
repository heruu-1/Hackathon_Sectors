import numpy as np
import pandas as pd
import json

# Set seed
SEED = 42
np.random.seed(SEED)

# Load data and compute historical volatilities
df_5m = pd.read_csv('scratch/bmri_5m_raw.csv')
df_5m['datetime'] = pd.to_datetime(df_5m['datetime'])
df_past = df_5m[df_5m['datetime'] <= '2026-09-22 12:00:00+07:00'].copy()

def get_session(dt):
    wd = dt.weekday()
    t = dt.time()
    if wd == 4:
        if pd.to_datetime('09:00:00').time() <= t <= pd.to_datetime('11:30:00').time(): return 'S1'
        elif pd.to_datetime('14:00:00').time() <= t <= pd.to_datetime('16:15:00').time(): return 'S2'
    else:
        if pd.to_datetime('09:00:00').time() <= t <= pd.to_datetime('12:00:00').time(): return 'S1'
        elif pd.to_datetime('13:30:00').time() <= t <= pd.to_datetime('16:15:00').time(): return 'S2'
    return 'Other'

df_past['session'] = df_past['datetime'].apply(get_session)
df_past['date'] = df_past['datetime'].dt.strftime('%Y-%m-%d')
df_sess = df_past[df_past['session'].isin(['S1', 'S2'])].copy()

session_bars = df_sess.groupby(['date', 'session']).agg(
    open=('open', 'first'),
    high=('high', 'max'),
    low=('low', 'min'),
    close=('close', 'last')
).reset_index().sort_values(['date', 'session'])

piv = session_bars.pivot(index='date', columns='session')
lunch_gap_returns = np.log(piv['open']['S2'] / piv['close']['S1']).dropna()
dates = sorted(piv.index)
overnight_gap_returns = []
for i in range(len(dates)-1):
    c_s2 = piv.loc[dates[i], ('close', 'S2')]
    o_s1 = piv.loc[dates[i+1], ('open', 'S1')]
    if not np.isnan(c_s2) and not np.isnan(o_s1):
        overnight_gap_returns.append(np.log(o_s1 / c_s2))
overnight_gap_returns = pd.Series(overnight_gap_returns)

# 15m and 5m bars
df_sess['logret_5m'] = np.log(df_sess['close'] / df_sess['close'].shift(1))
df_sess.loc[df_sess.groupby(['date', 'session']).head(1).index, 'logret_5m'] = np.nan

s1_5m = df_sess[df_sess['session'] == 'S1']['logret_5m'].dropna()
s2_5m = df_sess[df_sess['session'] == 'S2']['logret_5m'].dropna()

sigma_lunch = float(lunch_gap_returns.std())
sigma_overnight = float(overnight_gap_returns.std())
sigma_s1_5m = float(s1_5m.std())
sigma_s2_5m = float(s2_5m.std())

# 15-minute bars aggregation
df_sess['dt_15m'] = df_sess['datetime'].dt.floor('15min')
bars_15m = df_sess.groupby(['date', 'session', 'dt_15m']).agg(
    open=('open', 'first'),
    high=('high', 'max'),
    low=('low', 'min'),
    close=('close', 'last')
).reset_index().sort_values(['date', 'session', 'dt_15m'])

bars_15m['logret_15m'] = np.log(bars_15m['close'] / bars_15m['close'].shift(1))
bars_15m.loc[bars_15m.groupby(['date', 'session']).head(1).index, 'logret_15m'] = np.nan

s1_15m = bars_15m[bars_15m['session'] == 'S1']['logret_15m'].dropna()
s2_15m = bars_15m[bars_15m['session'] == 'S2']['logret_15m'].dropna()

sigma_s1_15m = float(s1_15m.std())
sigma_s2_15m = float(s2_15m.std())

print(f"Historical Volatilities:")
print(f"  Sigma Lunch Gap: {sigma_lunch:.6f}")
print(f"  Sigma Overnight Gap: {sigma_overnight:.6f}")
print(f"  Sigma S1 15m: {sigma_s1_15m:.6f}, N_bars=12")
print(f"  Sigma S2 15m: {sigma_s2_15m:.6f}, N_bars=9")
print(f"  Sigma S1 5m: {sigma_s1_5m:.6f}, N_bars=36")
print(f"  Sigma S2 5m: {sigma_s2_5m:.6f}, N_bars=28")

def run_simulation(
    N_paths=100000,
    seed=42,
    vol_multiplier=1.0,
    resolution='15m',
    E=4200,
    S0=4190,
    atr_initial=62.670334,
    slippage_ticks=1,
    tick=10
):
    np.random.seed(seed)
    
    # Trade parameters
    C = E * 1.0015
    SL = np.floor((E - 1.5 * atr_initial) / tick) * tick # 4100
    P_exit_sl = SL - slippage_ticks * tick # 4090
    R = C - P_exit_sl * (1 - 0.0025) # 126.525
    TP1 = np.ceil(((C + 1.25 * R) / 0.9975) / tick) * tick # 4380
    TP2 = np.ceil(((C + 2.0 * R) / 0.9975) / tick) * tick # 4480
    BEP = np.ceil((C / 0.9975 + slippage_ticks * tick) / tick) * tick # 4230
    
    # Setup steps
    # Horizon 3 sessions total = remaining 2 sessions (22 S2, 23 S1)
    # Horizon 5 sessions total = remaining 4 sessions (22 S2, 23 S1, 23 S2, 24 S1)
    if resolution == '15m':
        s_lunch = sigma_lunch * vol_multiplier
        s_overnight = sigma_overnight * vol_multiplier
        s_s1 = sigma_s1_15m * vol_multiplier
        s_s2 = sigma_s2_15m * vol_multiplier
        
        # Steps sequence:
        # [0] Lunch gap (1 step)
        # [1..9] 22 Sep S2 (9 steps) -> end of remaining session 1
        # [10] Overnight gap (1 step)
        # [11..22] 23 Sep S1 (12 steps) -> end of remaining session 2 (Horizon 3)
        # [23] Lunch gap (1 step)
        # [24..32] 23 Sep S2 (9 steps) -> end of remaining session 3
        # [33] Overnight gap (1 step)
        # [34..45] 24 Sep S1 (12 steps) -> end of remaining session 4 (Horizon 5)
        step_sigmas = (
            [s_lunch] +
            [s_s2] * 9 +
            [s_overnight] +
            [s_s1] * 12 +
            [s_lunch] +
            [s_s2] * 9 +
            [s_overnight] +
            [s_s1] * 12
        )
        idx_h3 = 1 + 9 + 1 + 12 - 1 # step 22 (0-indexed)
        idx_h5 = len(step_sigmas) - 1 # step 45
    else: # 5m
        s_lunch = sigma_lunch * vol_multiplier
        s_overnight = sigma_overnight * vol_multiplier
        s_s1 = sigma_s1_5m * vol_multiplier
        s_s2 = sigma_s2_5m * vol_multiplier
        
        step_sigmas = (
            [s_lunch] +
            [s_s2] * 28 +
            [s_overnight] +
            [s_s1] * 36 +
            [s_lunch] +
            [s_s2] * 28 +
            [s_overnight] +
            [s_s1] * 36
        )
        idx_h3 = 1 + 28 + 1 + 36 - 1
        idx_h5 = len(step_sigmas) - 1

    n_steps = len(step_sigmas)
    sigmas = np.array(step_sigmas)
    
    # Generate random standard normals: shape (N_paths, n_steps)
    Z = np.random.standard_normal((N_paths, n_steps))
    
    # Drift is zero for GBM: log returns d ln S = -0.5 * sigma^2 + sigma * Z
    log_returns = -0.5 * (sigmas ** 2) + sigmas * Z
    
    # Cumulative log returns
    cum_log_returns = np.cumsum(log_returns, axis=1)
    
    # Price paths: shape (N_paths, n_steps)
    paths = S0 * np.exp(cum_log_returns)
    
    # Prepend starting price S0 as step -1 for barrier checks
    all_prices = np.hstack([np.full((N_paths, 1), S0), paths])
    
    # Results containers
    res = {}
    
    for h_name, h_step in [('H3_2sess', idx_h3), ('H5_4sess', idx_h5)]:
        sub_paths = all_prices[:, 1:h_step + 2] # slice up to horizon step (plus 1 for 0-index)
        final_prices = sub_paths[:, -1]
        
        # 1. Distribution of final price
        p10 = np.percentile(final_prices, 10)
        p50 = np.percentile(final_prices, 50) # median
        p90 = np.percentile(final_prices, 90)
        
        # 2. Fixed Barrier Analysis:
        # Check first hitting times of TP1, TP2, SL
        # sub_paths has shape (N_paths, h_step + 1)
        hit_tp1_step = np.argmax(sub_paths >= TP1, axis=1)
        has_hit_tp1 = np.max(sub_paths >= TP1, axis=1)
        hit_tp1_step[~has_hit_tp1] = 999999
        
        hit_tp2_step = np.argmax(sub_paths >= TP2, axis=1)
        has_hit_tp2 = np.max(sub_paths >= TP2, axis=1)
        hit_tp2_step[~has_hit_tp2] = 999999
        
        hit_sl_step = np.argmax(sub_paths <= SL, axis=1)
        has_hit_sl = np.max(sub_paths <= SL, axis=1)
        hit_sl_step[~has_hit_sl] = 999999
        
        # Prob TP1 before SL and within horizon
        prob_tp1_before_sl = np.mean((hit_tp1_step < hit_sl_step) & has_hit_tp1)
        
        # Prob TP2 before SL and within horizon
        prob_tp2_before_sl = np.mean((hit_tp2_step < hit_sl_step) & has_hit_tp2)
        
        # Prob SL before TP1 within horizon
        prob_sl_before_tp1 = np.mean((hit_sl_step < hit_tp1_step) & has_hit_sl)
        
        # Prob SL before TP2 within horizon
        prob_sl_before_tp2 = np.mean((hit_sl_step < hit_tp2_step) & has_hit_sl)
        
        # Prob neither touched within horizon (neither TP1 nor SL)
        prob_neither_tp1_sl = np.mean((~has_hit_tp1) & (~has_hit_sl))
        
        # Prob neither TP2 nor SL
        prob_neither_tp2_sl = np.mean((~has_hit_tp2) & (~has_hit_sl))
        
        # 3. Dynamic Strategy with Partial Realization & Trailing Stop:
        # Lot sizes: say 39 lots total (19 at TP1, 20 to TP2) or fraction 0.5/0.5
        # Path-by-path simulation:
        # For each path, track state:
        # state 0: full position active, stop = SL
        # if touches SL: exit 100% at SL - slippage
        # if touches TP1: sell 50% at TP1. Remaining 50% stop = max(BEP, highest_bar - atr).
        # remaining position: if touches TP2 -> sell 50% at TP2.
        # if touches dynamic stop -> sell 50% at dynamic stop - slippage.
        # if reaches end -> exit at final price.
        
        # Let's compute outcomes for dynamic strategy across all paths:
        tp1_hit = (hit_tp1_step < hit_sl_step) & has_hit_tp1
        sl_first_hit = (hit_sl_step < hit_tp1_step) & has_hit_sl
        neither_first = (~has_hit_tp1) & (~has_hit_sl)
        
        # For paths that hit TP1 first, track second half:
        # second half starts at hit_tp1_step
        # running max of price after hit_tp1_step
        # we can vectorize or loop
        tp2_reached_after_tp1 = np.zeros(N_paths, dtype=bool)
        trailing_sl_hit_after_tp1 = np.zeros(N_paths, dtype=bool)
        closed_at_horizon_after_tp1 = np.zeros(N_paths, dtype=bool)
        
        tp1_indices = np.where(tp1_hit)[0]
        for idx in tp1_indices:
            step_start = hit_tp1_step[idx]
            sub_p = sub_paths[idx, step_start:] # prices from TP1 touch onwards
            # running highest price
            high_watermark = TP1
            current_stop = BEP
            hit_tp2_flag = False
            hit_trail_flag = False
            
            for pt in sub_p:
                if pt >= TP2:
                    hit_tp2_flag = True
                    break
                if pt > high_watermark:
                    high_watermark = pt
                    trail_candidate = high_watermark - atr_initial
                    if trail_candidate > current_stop:
                        current_stop = trail_candidate
                if pt <= current_stop:
                    hit_trail_flag = True
                    break
            
            if hit_tp2_flag:
                tp2_reached_after_tp1[idx] = True
            elif hit_trail_flag:
                trailing_sl_hit_after_tp1[idx] = True
            else:
                closed_at_horizon_after_tp1[idx] = True
        
        prob_strat_both_tp = np.mean(tp2_reached_after_tp1)
        prob_strat_tp1_then_trail = np.mean(trailing_sl_hit_after_tp1)
        prob_strat_tp1_then_time = np.mean(closed_at_horizon_after_tp1)
        prob_strat_sl_full = np.mean(sl_first_hit)
        prob_strat_neither = np.mean(neither_first)
        
        res[h_name] = {
            'final_median': p50,
            'final_p10': p10,
            'final_p90': p90,
            'fixed_tp1_before_sl': prob_tp1_before_sl,
            'fixed_tp2_before_sl': prob_tp2_before_sl,
            'fixed_sl_before_tp1': prob_sl_before_tp1,
            'fixed_neither_tp1_sl': prob_neither_tp1_sl,
            'fixed_neither_tp2_sl': prob_neither_tp2_sl,
            'strat_full_sl': prob_strat_sl_full,
            'strat_neither': prob_strat_neither,
            'strat_tp1_total': prob_tp1_before_sl,
            'strat_tp1_and_tp2': prob_strat_both_tp,
            'strat_tp1_then_trail': prob_strat_tp1_then_trail,
            'strat_tp1_then_time': prob_strat_tp1_then_time
        }
        
    return res

print("Running baseline simulation (vol=1.0, res=15m, slip=1)...")
base_res = run_simulation(vol_multiplier=1.0, resolution='15m', slippage_ticks=1)
print(json.dumps(base_res, indent=2))

print("\nRunning vol +25% sensitivity...")
vol_up_res = run_simulation(vol_multiplier=1.25, resolution='15m', slippage_ticks=1)
print(json.dumps(vol_up_res, indent=2))

print("\nRunning vol -25% sensitivity...")
vol_down_res = run_simulation(vol_multiplier=0.75, resolution='15m', slippage_ticks=1)
print(json.dumps(vol_down_res, indent=2))

print("\nRunning slippage 2 ticks sensitivity...")
slip2_res = run_simulation(vol_multiplier=1.0, resolution='15m', slippage_ticks=2)
print(json.dumps(slip2_res, indent=2))

print("\nRunning 5m resolution sensitivity...")
res_5m = run_simulation(vol_multiplier=1.0, resolution='5m', slippage_ticks=1)
print(json.dumps(res_5m, indent=2))
