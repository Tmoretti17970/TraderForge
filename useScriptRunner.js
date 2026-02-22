// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Script Runner Hook
//
// Auto-executes all enabled scripts against current chart data.
// Re-runs when:
//   - bars[] changes (symbol/timeframe change)
//   - scripts[] changes (toggle, param update)
//   - manual run from editor (merged via setEditorOutputs)
//
// Returns combined outputs array for ChartCanvas rendering.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useScriptStore } from '../state/useScriptStore.js';
import { executeScript } from '../engine/ScriptEngine.js';

/**
 * @param {Object[]} bars - Current OHLCV data
 * @returns {{ scriptOutputs, setEditorOutputs, errors }}
 */
export default function useScriptRunner(bars) {
  const scripts = useScriptStore((s) => s.scripts);
  const [editorOutputs, setEditorOutputsRaw] = useState({}); // { scriptId: outputs[] }
  const [errors, setErrors] = useState({}); // { scriptId: errorMsg }
  const prevBarsRef = useRef(null);

  // Get enabled scripts
  const enabledScripts = useMemo(
    () => scripts.filter((s) => s.enabled),
    [scripts]
  );

  // Auto-execute enabled scripts when bars or enabled scripts change
  useEffect(() => {
    if (!bars?.length || enabledScripts.length === 0) {
      // Clear outputs if no bars or no enabled scripts
      setEditorOutputsRaw({});
      setErrors({});
      return;
    }

    const newOutputs = {};
    const newErrors = {};

    for (const script of enabledScripts) {
      try {
        const result = executeScript(script.code, bars, script.params || {});
        if (result.error) {
          newErrors[script.id] = result.error;
        } else {
          // Tag each output with script metadata
          newOutputs[script.id] = result.outputs.map((out) => ({
            ...out,
            _scriptId: script.id,
            _scriptName: script.name,
          }));
        }
      } catch (err) {
        newErrors[script.id] = err.message || 'Execution failed';
      }
    }

    setEditorOutputsRaw(newOutputs);
    setErrors(newErrors);
    prevBarsRef.current = bars;
  }, [bars, enabledScripts]);

  // Manual editor output injection (from ScriptEditor "Run" button)
  const setEditorOutputs = useCallback((scriptId, outputs) => {
    if (!outputs?.length) {
      // Clear this script's outputs
      setEditorOutputsRaw((prev) => {
        const next = { ...prev };
        delete next[scriptId];
        return next;
      });
      return;
    }
    setEditorOutputsRaw((prev) => ({
      ...prev,
      [scriptId]: outputs.map((out) => ({
        ...out,
        _scriptId: scriptId,
        _scriptName: scripts.find((s) => s.id === scriptId)?.name || 'Script',
      })),
    }));
  }, [scripts]);

  // Flatten all outputs into a single array for chart rendering
  const scriptOutputs = useMemo(() => {
    const all = [];
    for (const outputs of Object.values(editorOutputs)) {
      all.push(...outputs);
    }
    return all;
  }, [editorOutputs]);

  return { scriptOutputs, setEditorOutputs, errors };
}
