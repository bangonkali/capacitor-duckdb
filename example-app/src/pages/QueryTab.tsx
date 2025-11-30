import { useState, useEffect } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonCard, IonCardHeader,
  IonCardTitle, IonCardContent, IonButton, IonIcon, IonTextarea, IonBadge, IonText,
  IonChip, IonSelect, IonSelectOption, IonItem, IonLabel, useIonToast,
  IonSpinner, IonModal, IonList, IonRadio, IonRadioGroup, IonButtons,
} from '@ionic/react';
import { playOutline, codeSlashOutline, flash, timeOutline, downloadOutline, folderOpenOutline, closeOutline } from 'ionicons/icons';
import { duckdb, TODO_DB, TAXI_DB, type ParquetCompression } from '../services/duckdb';

type DbName = typeof TAXI_DB | typeof TODO_DB;

const EXAMPLE_QUERIES: Record<DbName, { label: string; query: string }[]> = {
  [TAXI_DB]: [
    { label: 'Count All Trips', query: 'SELECT COUNT(*) as total FROM trips' },
    { label: 'Top 5 Expensive', query: 'SELECT * FROM trips ORDER BY total_amount DESC LIMIT 5' },
    { label: 'Avg by Zone', query: 'SELECT pickup_zone, AVG(total_amount) as avg_fare, COUNT(*) as trips FROM trips GROUP BY 1 ORDER BY 3 DESC LIMIT 10' },
    { label: 'Revenue by Payment', query: 'SELECT payment_type, SUM(total_amount) as revenue, COUNT(*) as trips FROM trips GROUP BY 1 ORDER BY 2 DESC' },
    { label: 'Hourly Distribution', query: 'SELECT EXTRACT(HOUR FROM pickup_datetime) as hour, COUNT(*) as trips FROM trips GROUP BY 1 ORDER BY 1' },
  ],
  [TODO_DB]: [
    { label: 'All Todos', query: 'SELECT * FROM todos ORDER BY created_at DESC' },
    { label: 'Completed', query: 'SELECT * FROM todos WHERE completed = true' },
    { label: 'Pending', query: 'SELECT * FROM todos WHERE completed = false' },
    { label: 'Count', query: 'SELECT COUNT(*) as total, SUM(CASE WHEN completed THEN 1 ELSE 0 END) as done FROM todos' },
  ],
};

const COMPRESSION_OPTIONS: { value: ParquetCompression; label: string; description: string }[] = [
  { value: 'snappy', label: 'Snappy', description: 'Fast compression, good balance' },
  { value: 'gzip', label: 'GZIP', description: 'Better compression, slower' },
  { value: 'zstd', label: 'Zstandard', description: 'Best balance of speed & ratio' },
  { value: 'uncompressed', label: 'None', description: 'No compression, fastest' },
];

const QueryTab: React.FC = () => {
  const [selectedDb, setSelectedDb] = useState<DbName>(TAXI_DB);
  const [query, setQuery] = useState('SELECT COUNT(*) as total FROM trips');
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [queryTime, setQueryTime] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState('');
  const [presentToast] = useIonToast();

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [compression, setCompression] = useState<ParquetCompression>('snappy');
  const [exportLoading, setExportLoading] = useState(false);
  const [savedDirectoryUri, setSavedDirectoryUri] = useState<string>('');
  const [savedDirectoryName, setSavedDirectoryName] = useState<string>('');

  useEffect(() => {
    duckdb.getVersion().then(setVersion).catch(console.error);
  }, []);

  const runQuery = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null); setResults([]); setColumns([]);
    try {
      const result = await duckdb.query(selectedDb, query.trim());
      setQueryTime(result.queryTime);
      setRowCount(result.values.length);
      if (result.values.length > 0) {
        setColumns(Object.keys(result.values[0]));
        setResults(result.values.slice(0, 100)); // Limit display
      }
      presentToast({ message: `Query completed in ${result.queryTime.toFixed(0)}ms`, duration: 2000, color: 'success' });
    } catch (err) {
      console.error('Query error:', err);
      setError((err as Error).message);
      presentToast({ message: 'Query failed', duration: 2000, color: 'danger' });
    } finally { setLoading(false); }
  };

  const setExampleQuery = (q: string) => { setQuery(q); setError(null); setResults([]); };

  const openExportModal = async () => {
    try {
      const tableList = await duckdb.listTables(selectedDb);
      setTables(tableList);
      setSelectedTable(tableList[0] || '');
      setShowExportModal(true);
    } catch (err) {
      console.error('Failed to list tables:', err);
      presentToast({ message: 'Failed to list tables: ' + (err as Error).message, duration: 3000, color: 'danger' });
    }
  };

  const pickDirectory = async () => {
    try {
      const result = await duckdb.pickDirectory();
      setSavedDirectoryUri(result.uri);
      setSavedDirectoryName(result.name);
      presentToast({ message: `Selected: ${result.name}`, duration: 2000, color: 'success' });
    } catch (err) {
      console.error('Directory picker error:', err);
      presentToast({ message: 'Directory selection cancelled', duration: 2000, color: 'warning' });
    }
  };

  const exportTable = async () => {
    if (!selectedTable || !savedDirectoryUri) {
      presentToast({ message: 'Please select a table and directory', duration: 2000, color: 'warning' });
      return;
    }

    setExportLoading(true);
    try {
      const result = await duckdb.exportToParquet(selectedDb, selectedTable, savedDirectoryUri, { compression });
      
      const fileSizeFormatted = result.fileSize > 1024 * 1024 
        ? `${(result.fileSize / (1024 * 1024)).toFixed(2)} MB`
        : `${(result.fileSize / 1024).toFixed(2)} KB`;
      
      setShowExportModal(false);
      presentToast({
        message: `Exported ${result.rowCount.toLocaleString()} rows (${fileSizeFormatted})`,
        duration: 4000,
        color: 'success',
      });
    } catch (err) {
      console.error('Export failed:', err);
      presentToast({ message: 'Export failed: ' + (err as Error).message, duration: 4000, color: 'danger' });
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader className="duckdb-header"><IonToolbar color="secondary">
        <IonTitle><span className="duckdb-logo">🦆</span>SQL Query{version && <IonBadge className="version-badge">v{version}</IonBadge>}</IonTitle>
        <IonButtons slot="end">
          <IonButton onClick={openExportModal}>
            <IonIcon slot="icon-only" icon={downloadOutline} />
          </IonButton>
        </IonButtons>
      </IonToolbar></IonHeader>
      <IonContent className="ion-padding">
        <IonItem><IonLabel>Database</IonLabel>
          <IonSelect value={selectedDb} onIonChange={(e) => { setSelectedDb(e.detail.value); setResults([]); setError(null); }}>
            <IonSelectOption value={TAXI_DB}>NYC Taxi (100K rows)</IonSelectOption>
            <IonSelectOption value={TODO_DB}>Todo List</IonSelectOption>
          </IonSelect>
        </IonItem>

        <IonCard><IonCardHeader><IonCardTitle><IonIcon icon={codeSlashOutline} style={{ marginRight: '8px' }} />SQL Editor</IonCardTitle></IonCardHeader>
          <IonCardContent>
            <IonTextarea className="sql-editor" value={query} onIonInput={(e) => setQuery(e.detail.value || '')} rows={5} placeholder="Enter SQL query..." autoGrow />
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <IonButton onClick={runQuery} disabled={loading || !query.trim()}><IonIcon slot="start" icon={playOutline} />{loading ? 'Running...' : 'Run Query'}</IonButton>
              <IonButton fill="outline" onClick={() => setQuery('')}>Clear</IonButton>
            </div>
          </IonCardContent>
        </IonCard>

        <IonCard><IonCardHeader><IonCardTitle><IonIcon icon={flash} style={{ marginRight: '8px' }} />Quick Queries</IonCardTitle></IonCardHeader>
          <IonCardContent>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {EXAMPLE_QUERIES[selectedDb]?.map((ex) => (<IonChip key={ex.label} onClick={() => setExampleQuery(ex.query)} color="primary" outline>{ex.label}</IonChip>))}
            </div>
          </IonCardContent>
        </IonCard>

        {error && (<IonCard color="danger"><IonCardContent><IonText color="light"><strong>Error:</strong> {error}</IonText></IonCardContent></IonCard>)}

        {results.length > 0 && (
          <IonCard><IonCardHeader>
            <IonCardTitle>Results <IonBadge color="primary" style={{ marginLeft: '8px' }}>{rowCount} rows</IonBadge><IonBadge color="success" style={{ marginLeft: '8px' }}><IonIcon icon={timeOutline} /> {queryTime.toFixed(0)}ms</IonBadge></IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div className="result-table" style={{ overflowX: 'auto' }}>
              <table><thead><tr>{columns.map((col) => (<th key={col}>{col}</th>))}</tr></thead>
                <tbody>{results.map((row, i) => (<tr key={`row-${i}`}>{columns.map((col) => (<td key={`${i}-${col}`}>{row[col] === null ? <IonText color="medium">NULL</IonText> : typeof row[col] === 'number' ? (Number.isInteger(row[col]) ? String(row[col]) : Number(row[col]).toFixed(2)) : String(row[col])}</td>))}</tr>))}</tbody>
              </table>
            </div>
            {rowCount > 100 && <IonText color="medium"><p style={{ marginTop: '12px', fontSize: '0.875rem' }}>Showing first 100 of {rowCount} rows</p></IonText>}
          </IonCardContent></IonCard>
        )}

        {!error && results.length === 0 && !loading && (<div className="ion-padding ion-text-center" style={{ marginTop: '32px' }}><IonText color="medium"><p>Enter a SQL query and click "Run Query" to see results.</p><p style={{ fontSize: '0.875rem' }}>Or click a quick query button above to get started.</p></IonText></div>)}

        {/* Export to Parquet Modal */}
        <IonModal isOpen={showExportModal} onDidDismiss={() => setShowExportModal(false)}>
          <IonHeader>
            <IonToolbar color="secondary">
              <IonTitle>Export to Parquet</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowExportModal(false)}>
                  <IonIcon slot="icon-only" icon={closeOutline} />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonCard>
              <IonCardHeader>
                <IonCardTitle><IonIcon icon={downloadOutline} style={{ marginRight: '8px' }} />Export Settings</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonList>
                  <IonItem>
                    <IonLabel>Table</IonLabel>
                    <IonSelect value={selectedTable} onIonChange={(e) => setSelectedTable(e.detail.value)}>
                      {tables.map((t) => (<IonSelectOption key={t} value={t}>{t}</IonSelectOption>))}
                    </IonSelect>
                  </IonItem>

                  <IonItem button onClick={pickDirectory}>
                    <IonIcon icon={folderOpenOutline} slot="start" />
                    <IonLabel>
                      <h2>Destination Folder</h2>
                      <p>{savedDirectoryName || 'Tap to select...'}</p>
                    </IonLabel>
                  </IonItem>

                  <IonRadioGroup value={compression} onIonChange={(e) => setCompression(e.detail.value)}>
                    <IonItem><IonLabel className="ion-text-wrap"><h3>Compression</h3></IonLabel></IonItem>
                    {COMPRESSION_OPTIONS.map((opt) => (
                      <IonItem key={opt.value}>
                        <IonLabel className="ion-text-wrap">
                          <h3>{opt.label}</h3>
                          <p>{opt.description}</p>
                        </IonLabel>
                        <IonRadio slot="end" value={opt.value} />
                      </IonItem>
                    ))}
                  </IonRadioGroup>
                </IonList>

                <div style={{ marginTop: '24px' }}>
                  <IonButton expand="block" onClick={exportTable} disabled={exportLoading || !selectedTable || !savedDirectoryUri}>
                    {exportLoading ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={downloadOutline} />Export {selectedTable}.parquet</>}
                  </IonButton>
                </div>

                <IonText color="medium">
                  <p style={{ marginTop: '16px', fontSize: '0.875rem', textAlign: 'center' }}>
                    Parquet is a columnar file format optimized for analytics. 
                    Files can be opened in DuckDB, Pandas, Apache Spark, and more.
                  </p>
                </IonText>
              </IonCardContent>
            </IonCard>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default QueryTab;
