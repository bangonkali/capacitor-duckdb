/**
 * FunctionCard - Interactive Spatial Function Demo Card
 * 
 * Displays function signature, description, SQL example,
 * and provides a Run button to execute the demo.
 */

import { useState, useCallback } from 'react';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
  IonAccordion,
  IonAccordionGroup,
  IonItem,
  IonLabel,
  IonChip,
  IonBadge,
} from '@ionic/react';
import {
  playOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  codeSlashOutline,
  chevronDownOutline,
  copyOutline,
  timeOutline,
} from 'ionicons/icons';

import './FunctionCard.css';

// ============================================================================
// Types
// ============================================================================

export interface FunctionExample {
  /** Brief description of what this example demonstrates */
  description: string;
  /** The SQL query to run */
  sql: string;
  /** Expected result description (optional) */
  expectedResult?: string;
}

export interface FunctionDef {
  /** Function name (e.g., "ST_Distance") */
  name: string;
  /** Category (e.g., "Measurements") */
  category: string;
  /** Function signature (e.g., "ST_Distance(geom1, geom2)") */
  signature: string;
  /** Brief description */
  description: string;
  /** Return type */
  returnType: string;
  /** Parameter descriptions */
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    optional?: boolean;
  }>;
  /** Usage examples */
  examples: FunctionExample[];
  /** Notes or caveats */
  notes?: string[];
  /** Link to documentation */
  docsUrl?: string;
}

export interface FunctionCardProps {
  /** Function definition */
  func: FunctionDef;
  /** Callback to run SQL query */
  onRunQuery: (sql: string) => Promise<{ rows: unknown[]; duration: number }>;
  /** Optional: callback when result is shown on map */
  onShowOnMap?: (wkt: string) => void;
  /** Whether card is initially expanded */
  defaultExpanded?: boolean;
}

export interface QueryResult {
  rows: unknown[];
  duration: number;
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

const FunctionCard: React.FC<FunctionCardProps> = ({
  func,
  onRunQuery,
  onShowOnMap,
  defaultExpanded = false,
}) => {
  const [expandedExample, setExpandedExample] = useState<number | null>(
    defaultExpanded && func.examples.length > 0 ? 0 : null
  );
  const [results, setResults] = useState<Map<number, QueryResult>>(new Map());
  const [loadingExample, setLoadingExample] = useState<number | null>(null);

  // Run query for an example
  const runExample = useCallback(async (exampleIndex: number) => {
    const example = func.examples[exampleIndex];
    if (!example) return;

    setLoadingExample(exampleIndex);
    try {
      const result = await onRunQuery(example.sql);
      setResults((prev) => {
        const updated = new Map(prev);
        updated.set(exampleIndex, {
          rows: result.rows,
          duration: result.duration,
        });
        return updated;
      });
    } catch (err) {
      setResults((prev) => {
        const updated = new Map(prev);
        updated.set(exampleIndex, {
          rows: [],
          duration: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        return updated;
      });
    } finally {
      setLoadingExample(null);
    }
  }, [func.examples, onRunQuery]);

  // Copy SQL to clipboard
  const copySql = useCallback(async (sql: string) => {
    try {
      await navigator.clipboard.writeText(sql);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Format result for display
  const formatResult = (result: QueryResult): string => {
    if (result.error) {
      return `Error: ${result.error}`;
    }
    if (result.rows.length === 0) {
      return 'No results';
    }
    if (result.rows.length === 1) {
      const row = result.rows[0];
      if (typeof row === 'object' && row !== null) {
        const values = Object.values(row);
        if (values.length === 1) {
          return String(values[0]);
        }
        return JSON.stringify(row, null, 2);
      }
      return String(row);
    }
    return JSON.stringify(result.rows, null, 2);
  };

  return (
    <IonCard className="function-card">
      <IonCardHeader>
        <IonCardSubtitle color="primary">{func.category}</IonCardSubtitle>
        <IonCardTitle className="function-name">{func.name}</IonCardTitle>
        <code className="function-signature">{func.signature}</code>
      </IonCardHeader>

      <IonCardContent>
        {/* Description */}
        <p className="function-description">{func.description}</p>

        {/* Return type */}
        <div className="return-type">
          <IonBadge color="secondary">Returns: {func.returnType}</IonBadge>
        </div>

        {/* Parameters */}
        {func.parameters.length > 0 && (
          <div className="parameters-section">
            <h4>Parameters</h4>
            <div className="parameters-list">
              {func.parameters.map((param, i) => (
                <div key={i} className="parameter">
                  <span className="param-name">{param.name}</span>
                  <span className="param-type">{param.type}</span>
                  {param.optional && <IonChip color="medium">optional</IonChip>}
                  <span className="param-desc">{param.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Examples */}
        <div className="examples-section">
          <h4>Examples</h4>
          <IonAccordionGroup
            value={expandedExample !== null ? `example-${expandedExample}` : undefined}
            onIonChange={(e) => {
              const value = e.detail.value;
              if (value) {
                const index = parseInt(value.replace('example-', ''), 10);
                setExpandedExample(index);
              } else {
                setExpandedExample(null);
              }
            }}
          >
            {func.examples.map((example, i) => {
              const result = results.get(i);
              const isLoading = loadingExample === i;

              return (
                <IonAccordion key={i} value={`example-${i}`}>
                  <IonItem slot="header" lines="none">
                    <IonIcon
                      icon={
                        result?.error
                          ? alertCircleOutline
                          : result
                          ? checkmarkCircleOutline
                          : codeSlashOutline
                      }
                      slot="start"
                      color={result?.error ? 'danger' : result ? 'success' : 'medium'}
                    />
                    <IonLabel>
                      {example.description}
                      {result && !result.error && (
                        <IonChip color="success" outline>
                          <IonIcon icon={timeOutline} />
                          <IonLabel>{result.duration.toFixed(1)}ms</IonLabel>
                        </IonChip>
                      )}
                    </IonLabel>
                    <IonIcon icon={chevronDownOutline} slot="end" className="accordion-icon" />
                  </IonItem>

                  <div className="ion-padding example-content" slot="content">
                    {/* SQL */}
                    <div className="sql-block">
                      <div className="sql-header">
                        <span>SQL</span>
                        <IonButton
                          fill="clear"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            copySql(example.sql);
                          }}
                        >
                          <IonIcon slot="icon-only" icon={copyOutline} />
                        </IonButton>
                      </div>
                      <pre className="sql-code">{example.sql}</pre>
                    </div>

                    {/* Action buttons */}
                    <div className="example-actions">
                      <IonButton
                        expand="block"
                        onClick={() => runExample(i)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <IonSpinner name="crescent" slot="start" />
                            Running...
                          </>
                        ) : (
                          <>
                            <IonIcon slot="start" icon={playOutline} />
                            Run Example
                          </>
                        )}
                      </IonButton>
                    </div>

                    {/* Result */}
                    {result && (
                      <div className={`result-block ${result.error ? 'error' : 'success'}`}>
                        <div className="result-header">
                          <span>{result.error ? 'Error' : 'Result'}</span>
                          {!result.error && onShowOnMap && result.rows.length > 0 && (
                            <IonButton
                              fill="clear"
                              size="small"
                              onClick={() => {
                                // Try to extract geometry from result
                                const row = result.rows[0] as Record<string, unknown>;
                                const geom = row?.geom || row?.geometry || Object.values(row)[0];
                                if (typeof geom === 'string') {
                                  onShowOnMap(geom);
                                }
                              }}
                            >
                              Show on Map
                            </IonButton>
                          )}
                        </div>
                        <pre className="result-code">{formatResult(result)}</pre>
                        {!result.error && (
                          <div className="result-meta">
                            <IonText color="medium">
                              {result.rows.length} row(s) · {result.duration.toFixed(2)}ms
                            </IonText>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expected result hint */}
                    {example.expectedResult && !result && (
                      <IonText color="medium">
                        <p className="expected-hint">
                          <strong>Expected:</strong> {example.expectedResult}
                        </p>
                      </IonText>
                    )}
                  </div>
                </IonAccordion>
              );
            })}
          </IonAccordionGroup>
        </div>

        {/* Notes */}
        {func.notes && func.notes.length > 0 && (
          <div className="notes-section">
            <h4>Notes</h4>
            <ul>
              {func.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Documentation link */}
        {func.docsUrl && (
          <div className="docs-link">
            <a href={func.docsUrl} target="_blank" rel="noopener noreferrer">
              View Documentation →
            </a>
          </div>
        )}
      </IonCardContent>
    </IonCard>
  );
};

export default FunctionCard;
