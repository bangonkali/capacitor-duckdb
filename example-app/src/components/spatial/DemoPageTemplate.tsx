/**
 * DemoPageTemplate - Base component for spatial function demo pages
 * 
 * Provides consistent layout with header, description, and function cards.
 */

import { useState, useCallback } from 'react';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonText,
  type RefresherEventDetail,
} from '@ionic/react';
import { openOutline } from 'ionicons/icons';

import FunctionCard, { type FunctionDef } from './FunctionCard';
import { duckdb } from '../../services/duckdb';
import { SPATIAL_DB } from '../../services/spatialService';

import './DemoPageTemplate.css';

// ============================================================================
// Types
// ============================================================================

export interface DemoPageTemplateProps {
  /** Page title */
  title: string;
  /** Category icon (Ionicons) */
  icon: string;
  /** Category color (Ionic color name) */
  color: string;
  /** Page description */
  description: string;
  /** Function definitions to display */
  functions: FunctionDef[];
  /** Link to DuckDB documentation */
  docsUrl?: string;
}

// ============================================================================
// Component
// ============================================================================

const DemoPageTemplate: React.FC<DemoPageTemplateProps> = ({
  title,
  icon,
  color,
  description,
  functions,
  docsUrl,
}) => {
  const [expandedIndex] = useState<number | null>(0);

  // Run SQL query
  const runQuery = useCallback(async (sql: string) => {
    const startTime = performance.now();
    const result = await duckdb.query(SPATIAL_DB, sql);
    const duration = performance.now() - startTime;
    
    return {
      rows: result.values || [],
      duration,
    };
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async (event: CustomEvent<RefresherEventDetail>) => {
    // Nothing to refresh currently, just complete
    event.detail.complete();
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color={color}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/spatial" />
          </IonButtons>
          <IonTitle>
            <IonIcon icon={icon} className="title-icon" />
            {title}
          </IonTitle>
          {docsUrl && (
            <IonButtons slot="end">
              <IonButton href={docsUrl} target="_blank">
                <IonIcon slot="icon-only" icon={openOutline} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Page header */}
        <div className={`page-header ${color}`}>
          <div className="page-icon">
            <IonIcon icon={icon} />
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="function-count">
            <IonText color="medium">
              {functions.length} function{functions.length !== 1 ? 's' : ''}
            </IonText>
          </div>
        </div>

        {/* Function cards */}
        <div className="function-list">
          {functions.map((func, index) => (
            <FunctionCard
              key={func.name}
              func={func}
              onRunQuery={runQuery}
              defaultExpanded={expandedIndex === index}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="page-footer">
          <IonText color="medium">
            <p>
              Data powered by DuckDB Spatial Extension
              {docsUrl && (
                <>
                  {' · '}
                  <a href={docsUrl} target="_blank" rel="noopener noreferrer">
                    Full Documentation
                  </a>
                </>
              )}
            </p>
          </IonText>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default DemoPageTemplate;
