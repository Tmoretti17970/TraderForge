// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Public Profile Page (Sprint 8)
//
// S1.2: SEO-ready page for /trader/:username
// Shows: avatar, display name, bio, public stats, shared snapshots.
//
// Server-renderable with SSR data injection.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useMemo } from 'react';
import { C, F, M } from '../../constants.js';
import { PublicNav, PublicFooter } from './PublicSymbolPage.jsx';

/**
 * @param {Object} props
 * @param {string} props.username
 * @param {Object} [props.ssrData] - { profile, snapshots, stats }
 */
export default function PublicProfilePage({ username, ssrData }) {
  const [data, setData] = useState(ssrData || null);
  const [loading, setLoading] = useState(!ssrData);
  const [tab, setTab] = useState('snapshots'); // 'snapshots' | 'stats'

  // Client-side fetch if no SSR data
  useEffect(() => {
    if (ssrData) return;
    setLoading(true);
    // In production: fetch(`/api/profile/${username}`)
    // For now, simulate with localStorage social data
    const timer = setTimeout(() => {
      setData({
        profile: {
          username: username || 'trader',
          displayName: username || 'Trader',
          bio: 'Trading futures and crypto. Sharing my journey.',
          avatar: '🔥',
          joinDate: '2024-06-15T00:00:00Z',
          followerCount: 0,
          followingCount: 0,
        },
        snapshots: [],
        stats: {
          totalShared: 0,
          totalLikes: 0,
          topSymbols: [],
        },
      });
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [username, ssrData]);

  // SEO meta tags
  useEffect(() => {
    if (!data?.profile) return;
    const p = data.profile;
    document.title = `${p.displayName || p.username} — TradeForge Trader Profile`;

    // Open Graph
    const setMeta = (prop, content) => {
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('og:title', `${p.displayName} on TradeForge`);
    setMeta('og:description', p.bio || `View ${p.displayName}'s trading snapshots on TradeForge.`);
    setMeta('og:type', 'profile');
  }, [data]);

  if (loading || !data?.profile) {
    return (
      <div style={pageStyle}>
        <PublicNav />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: C.t2 }}>
          Loading profile...
        </div>
        <PublicFooter />
      </div>
    );
  }

  const { profile, snapshots = [], stats = {} } = data;

  return (
    <div style={pageStyle}>
      <PublicNav />

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
        {/* Profile Header */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: C.sf2, border: `2px solid ${C.bd2}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32,
          }}>
            {profile.avatar || '🔥'}
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: F, color: C.t1, margin: 0 }}>
              {profile.displayName || profile.username}
            </h1>
            <div style={{ fontSize: 12, color: C.t3, fontFamily: M, marginTop: 2 }}>
              @{profile.username}
              {profile.joinDate && (
                <span> · Joined {new Date(profile.joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              )}
            </div>
            {profile.bio && (
              <div style={{ fontSize: 13, color: C.t2, marginTop: 8, lineHeight: 1.5, maxWidth: 500 }}>
                {profile.bio}
              </div>
            )}
          </div>

          {/* Follow stats */}
          <div style={{ display: 'flex', gap: 20, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: C.t1 }}>
                {stats.totalShared || snapshots.length}
              </div>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>Snapshots</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: C.t1 }}>
                {stats.totalLikes || 0}
              </div>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>Likes</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: C.t1 }}>
                {profile.followerCount || 0}
              </div>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>Followers</div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: `1px solid ${C.bd}`, marginBottom: 24,
        }}>
          {[
            { id: 'snapshots', label: 'Shared Snapshots' },
            { id: 'stats', label: 'Trading Stats' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="tf-btn"
              role="tab"
              aria-selected={tab === t.id}
              style={{
                padding: '10px 20px', border: 'none', cursor: 'pointer',
                background: 'none',
                color: tab === t.id ? C.info : C.t3,
                borderBottom: tab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
                fontWeight: 700, fontSize: 12, fontFamily: F,
                transition: 'all 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'snapshots' && (
          <div>
            {snapshots.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                color: C.t3, fontSize: 13,
              }}>
                No shared snapshots yet. When {profile.displayName} shares chart snapshots, they will appear here.
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 16,
              }}>
                {snapshots.map((snap) => (
                  <SnapshotCard key={snap.id} snapshot={snap} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'stats' && (
          <div style={{
            padding: 24, borderRadius: 8,
            background: C.bg2, border: `1px solid ${C.bd}`,
          }}>
            <div style={{ fontSize: 13, color: C.t2, textAlign: 'center' }}>
              Public trading stats will be available when {profile.displayName} opts into sharing performance metrics.
            </div>

            {/* Top symbols if available */}
            {stats.topSymbols?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, marginBottom: 10 }}>
                  MOST TRADED
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {stats.topSymbols.map((sym) => (
                    <span key={sym} style={{
                      padding: '4px 10px', borderRadius: 4,
                      background: C.info + '12', border: `1px solid ${C.info}30`,
                      fontSize: 11, fontFamily: M, color: C.info,
                    }}>
                      {sym}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}

// ─── Snapshot Card ──────────────────────────────────────────────

function SnapshotCard({ snapshot }) {
  const s = snapshot;

  return (
    <div style={{
      borderRadius: 8, overflow: 'hidden',
      background: C.bg2, border: `1px solid ${C.bd}`,
      transition: 'border-color 0.2s',
      cursor: 'pointer',
    }}>
      {/* Chart preview placeholder */}
      <div style={{
        height: 140, background: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontFamily: M, color: C.t3,
      }}>
        {s.symbol || 'Chart'} · {s.tf || '3M'}
      </div>

      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
          {s.title || 'Untitled Snapshot'}
        </div>
        {s.description && (
          <div style={{
            fontSize: 11, color: C.t2, lineHeight: 1.4,
            maxHeight: 36, overflow: 'hidden',
          }}>
            {s.description}
          </div>
        )}
        <div style={{
          display: 'flex', gap: 8, marginTop: 8,
          fontSize: 10, fontFamily: M, color: C.t3,
        }}>
          {s.likeCount != null && <span>❤️ {s.likeCount}</span>}
          {s.createdAt && <span>{new Date(s.createdAt).toLocaleDateString()}</span>}
          {s.tags?.length > 0 && s.tags.map(t => (
            <span key={t} style={{ color: C.p }}>#{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const pageStyle = {
  minHeight: '100vh',
  background: C.bg,
  color: C.t1,
  fontFamily: F,
};

export { PublicProfilePage, SnapshotCard };
