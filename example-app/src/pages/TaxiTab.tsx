import { useState, useEffect } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonCard,
  IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon,
  IonProgressBar, IonBadge, IonText, IonRefresher, IonRefresherContent,
  IonGrid, IonRow, IonCol, useIonToast,
} from '@ionic/react';
import type { RefresherEventDetail } from '@ionic/react';
import { carOutline, cashOutline, timeOutline, trendingUpOutline, mapOutline, refresh, warning } from 'ionicons/icons';
import { duckdb, TAXI_DB } from '../services/duckdb';

interface DashboardStats {
  totalTrips: number; avgFare: number; avgTip: number;
  avgDistance: number; totalRevenue: number; avgTripDuration: number;
}

interface QueryCache {
  topExpensive: Array<Record<string, unknown>>;
  bestTipHours: Array<Record<string, unknown>>;
  busiestZones: Array<Record<string, unknown>>;
  longestTrips: Array<Record<string, unknown>>;
}

const TaxiTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing DuckDB...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [version, setVersion] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queryCache, setQueryCache] = useState<QueryCache | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastQueryTime, setLastQueryTime] = useState(0);
  const [presentToast] = useIonToast();

  const generateDemoData = async () => {
    setLoadingMessage('Creating taxi trips table...');
    setLoadingProgress(0.4);
    await duckdb.execute(TAXI_DB, `CREATE TABLE IF NOT EXISTS trips (trip_id INTEGER PRIMARY KEY, pickup_datetime TIMESTAMP, dropoff_datetime TIMESTAMP, passenger_count INTEGER, trip_distance DOUBLE, pickup_zone VARCHAR, dropoff_zone VARCHAR, payment_type VARCHAR, fare_amount DOUBLE, tip_amount DOUBLE, tolls_amount DOUBLE, total_amount DOUBLE);`);

    const batchSize = 10000, totalRows = 1000000;
    const zones = ['Manhattan - Midtown', 'Manhattan - Downtown', 'Manhattan - Uptown', 'Brooklyn - Downtown', 'Brooklyn - Williamsburg', 'Queens - Astoria', 'Queens - Jamaica', 'Bronx - South', 'JFK Airport', 'LaGuardia Airport', 'Newark Airport', 'Times Square', 'Central Park', 'Wall Street', 'Harlem'];
    const paymentTypes = ['Credit Card', 'Cash', 'No Charge', 'Dispute'];

    for (let batch = 0; batch < totalRows / batchSize; batch++) {
      setLoadingProgress(0.5 + (batch / (totalRows / batchSize)) * 0.35);
      setLoadingMessage(`Generating taxi rides... ${((batch + 1) * batchSize).toLocaleString()} / ${totalRows.toLocaleString()}`);
      const values: string[] = [];
      for (let i = 0; i < batchSize; i++) {
        const tripId = batch * batchSize + i + 1;
        const baseDate = new Date('2023-01-01');
        const pickupDate = new Date(baseDate.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);
        const tripMinutes = 5 + Math.random() * 55;
        const dropoffDate = new Date(pickupDate.getTime() + tripMinutes * 60 * 1000);
        const passengers = 1 + Math.floor(Math.random() * 4);
        const distance = 0.5 + Math.random() * 20;
        const pickupZone = zones[Math.floor(Math.random() * zones.length)];
        const dropoffZone = zones[Math.floor(Math.random() * zones.length)];
        const payment = paymentTypes[Math.floor(Math.random() * paymentTypes.length)];
        const fare = 2.5 + distance * 2.5 + tripMinutes * 0.5;
        const tip = payment === 'Credit Card' ? fare * (0.15 + Math.random() * 0.1) : 0;
        const tolls = Math.random() > 0.8 ? 6.55 : 0;
        const total = fare + tip + tolls;
        values.push(`(${tripId}, '${pickupDate.toISOString()}', '${dropoffDate.toISOString()}', ${passengers}, ${distance.toFixed(2)}, '${pickupZone}', '${dropoffZone}', '${payment}', ${fare.toFixed(2)}, ${tip.toFixed(2)}, ${tolls.toFixed(2)}, ${total.toFixed(2)})`);
      }
      await duckdb.execute(TAXI_DB, `INSERT INTO trips VALUES ${values.join(',')}`);
    }
    setLoadingMessage('Creating indexes...');
    setLoadingProgress(0.87);
    await duckdb.execute(TAXI_DB, `CREATE INDEX IF NOT EXISTS idx_pickup_time ON trips(pickup_datetime); CREATE INDEX IF NOT EXISTS idx_distance ON trips(trip_distance); CREATE INDEX IF NOT EXISTS idx_total_amount ON trips(total_amount); CREATE INDEX IF NOT EXISTS idx_pickup_zone ON trips(pickup_zone);`);
  };

  const loadDashboard = async () => {
    const startTime = performance.now();
    const statsResult = await duckdb.query(TAXI_DB, `SELECT COUNT(*) as total_trips, AVG(fare_amount) as avg_fare, AVG(tip_amount) as avg_tip, AVG(trip_distance) as avg_distance, SUM(total_amount) as total_revenue, AVG(EXTRACT(EPOCH FROM (dropoff_datetime - pickup_datetime)) / 60) as avg_duration FROM trips`);
    if (statsResult.values.length > 0) {
      const s = statsResult.values[0];
      setStats({ totalTrips: Number(s.total_trips), avgFare: Number(s.avg_fare), avgTip: Number(s.avg_tip), avgDistance: Number(s.avg_distance), totalRevenue: Number(s.total_revenue), avgTripDuration: Number(s.avg_duration) });
    }
    const [topExpensive, bestTipHours, busiestZones, longestTrips] = await Promise.all([
      duckdb.query(TAXI_DB, `SELECT trip_id, total_amount, trip_distance, pickup_zone, dropoff_zone FROM trips ORDER BY total_amount DESC LIMIT 10`),
      duckdb.query(TAXI_DB, `SELECT EXTRACT(HOUR FROM pickup_datetime) as hour, AVG(tip_amount / NULLIF(fare_amount, 0)) * 100 as avg_tip_pct, COUNT(*) as trip_count FROM trips WHERE tip_amount > 0 GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      duckdb.query(TAXI_DB, `SELECT pickup_zone, COUNT(*) as trips, AVG(total_amount) as avg_fare FROM trips GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      duckdb.query(TAXI_DB, `SELECT trip_id, trip_distance, total_amount, pickup_zone, dropoff_zone FROM trips ORDER BY trip_distance DESC LIMIT 10`),
    ]);
    setQueryCache({ topExpensive: topExpensive.values, bestTipHours: bestTipHours.values, busiestZones: busiestZones.values, longestTrips: longestTrips.values });
    setLastQueryTime(performance.now() - startTime);
  };

  const checkAndLoadData = async () => {
    try {
      setLoadingMessage('Connecting to DuckDB...'); setLoadingProgress(0.1);
      const ver = await duckdb.getVersion(); setVersion(ver);
      setLoadingMessage('Checking for existing data...'); setLoadingProgress(0.2);
      const tableCheck = await duckdb.query(TAXI_DB, "SELECT table_name FROM duckdb_tables() WHERE table_name = 'trips'");
      if (tableCheck.values.length === 0) { setLoadingMessage('First launch - generating demo taxi rides...'); setLoadingProgress(0.3); await generateDemoData(); }
      setLoadingMessage('Loading dashboard...'); setLoadingProgress(0.9);
      await loadDashboard();
      setLoadingProgress(1); setDataLoaded(true); setLoading(false);
    } catch (error) {
      console.error('Init error:', error);
      setLoadingMessage(`Error: ${(error as Error).message}`);
      presentToast({ message: `Error: ${(error as Error).message}`, duration: 5000, color: 'danger' });
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => { await loadDashboard(); event.detail.complete(); };
  const resetDatabase = async () => {
    setLoading(true); setDataLoaded(false); setStats(null); setQueryCache(null);
    try { await duckdb.deleteDatabase(TAXI_DB); await checkAndLoadData(); }
    catch (error) { console.error('Reset error:', error); setLoading(false); }
  };

  useEffect(() => { checkAndLoadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <IonPage><IonContent className="ion-padding">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🦆</div>
        <h2>{loadingMessage}</h2>
        <IonProgressBar value={loadingProgress} color="primary" style={{ marginTop: '16px', maxWidth: '300px' }} />
        <p style={{ marginTop: '12px', color: 'var(--ion-color-medium)' }}>{Math.round(loadingProgress * 100)}%</p>
      </div>
    </IonContent></IonPage>
  );

  if (!dataLoaded || !stats) return (
    <IonPage><IonHeader><IonToolbar color="secondary"><IonTitle>NYC Taxi Analytics</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><div className="empty-state"><IonIcon icon={warning} color="warning" style={{ fontSize: '4rem' }} /><h2>Unable to load data</h2><IonButton onClick={checkAndLoadData}>Try Again</IonButton></div></IonContent>
    </IonPage>
  );

  return (
    <IonPage>
      <IonHeader className="duckdb-header"><IonToolbar color="secondary">
        <IonTitle><span className="duckdb-logo">🦆</span>NYC Taxi Analytics{version && <IonBadge className="version-badge">v{version}</IonBadge>}</IonTitle>
        <IonButton slot="end" fill="clear" color="light" onClick={resetDatabase}><IonIcon icon={refresh} /></IonButton>
      </IonToolbar></IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}><IonRefresherContent /></IonRefresher>
        <div className="ion-padding ion-text-center" style={{ background: 'var(--ion-color-secondary)', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 'bold' }}>{stats.totalTrips.toLocaleString()}</h1>
          <p style={{ margin: '4px 0' }}>Taxi Rides Loaded</p>
          <IonBadge color="success" style={{ marginTop: '8px' }}>Dashboard loaded in {lastQueryTime.toFixed(0)}ms</IonBadge>
        </div>
        <IonGrid><IonRow>
          <IonCol size="6"><IonCard className="stat-card"><IonCardHeader><IonIcon icon={cashOutline} color="primary" style={{ fontSize: '1.5rem' }} /><IonCardTitle style={{ fontSize: '0.875rem', marginTop: '8px' }}>Avg Fare</IonCardTitle></IonCardHeader><IonCardContent><div className="stat-value">${stats.avgFare.toFixed(2)}</div></IonCardContent></IonCard></IonCol>
          <IonCol size="6"><IonCard className="stat-card"><IonCardHeader><IonIcon icon={trendingUpOutline} color="success" style={{ fontSize: '1.5rem' }} /><IonCardTitle style={{ fontSize: '0.875rem', marginTop: '8px' }}>Avg Tip</IonCardTitle></IonCardHeader><IonCardContent><div className="stat-value">${stats.avgTip.toFixed(2)}</div></IonCardContent></IonCard></IonCol>
        </IonRow><IonRow>
          <IonCol size="6"><IonCard className="stat-card"><IonCardHeader><IonIcon icon={carOutline} color="tertiary" style={{ fontSize: '1.5rem' }} /><IonCardTitle style={{ fontSize: '0.875rem', marginTop: '8px' }}>Avg Distance</IonCardTitle></IonCardHeader><IonCardContent><div className="stat-value">{stats.avgDistance.toFixed(1)} mi</div></IonCardContent></IonCard></IonCol>
          <IonCol size="6"><IonCard className="stat-card"><IonCardHeader><IonIcon icon={timeOutline} color="warning" style={{ fontSize: '1.5rem' }} /><IonCardTitle style={{ fontSize: '0.875rem', marginTop: '8px' }}>Avg Duration</IonCardTitle></IonCardHeader><IonCardContent><div className="stat-value">{stats.avgTripDuration.toFixed(0)} min</div></IonCardContent></IonCard></IonCol>
        </IonRow></IonGrid>
        <IonCard style={{ margin: '16px' }}><IonCardHeader><IonCardTitle><IonIcon icon={cashOutline} style={{ marginRight: '8px' }} />Total Revenue</IonCardTitle></IonCardHeader><IonCardContent><div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--ion-color-success)' }}>${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></IonCardContent></IonCard>
        {queryCache && (<>
          <IonCard style={{ margin: '16px' }}><IonCardHeader><IonCardTitle>💰 Top 10 Most Expensive Trips</IonCardTitle></IonCardHeader><IonCardContent><div className="result-table"><table><thead><tr><th>Amount</th><th>Distance</th><th>Route</th></tr></thead><tbody>{queryCache.topExpensive.map((trip, i) => (<tr key={i}><td style={{ fontWeight: 'bold', color: 'var(--ion-color-success)' }}>${Number(trip.total_amount).toFixed(2)}</td><td>{Number(trip.trip_distance).toFixed(1)} mi</td><td style={{ fontSize: '0.75rem' }}>{String(trip.pickup_zone)} → {String(trip.dropoff_zone)}</td></tr>))}</tbody></table></div></IonCardContent></IonCard>
          <IonCard style={{ margin: '16px' }}><IonCardHeader><IonCardTitle>⏰ Best Hours for Tips</IonCardTitle></IonCardHeader><IonCardContent><div className="result-table"><table><thead><tr><th>Hour</th><th>Avg Tip %</th><th>Trips</th></tr></thead><tbody>{queryCache.bestTipHours.map((row, i) => (<tr key={i}><td>{String(row.hour).padStart(2, '0')}:00</td><td style={{ fontWeight: 'bold', color: 'var(--ion-color-primary)' }}>{Number(row.avg_tip_pct).toFixed(1)}%</td><td>{Number(row.trip_count).toLocaleString()}</td></tr>))}</tbody></table></div></IonCardContent></IonCard>
          <IonCard style={{ margin: '16px' }}><IonCardHeader><IonCardTitle><IonIcon icon={mapOutline} style={{ marginRight: '8px' }} />Busiest Pickup Zones</IonCardTitle></IonCardHeader><IonCardContent><div className="result-table"><table><thead><tr><th>Zone</th><th>Trips</th><th>Avg Fare</th></tr></thead><tbody>{queryCache.busiestZones.map((row, i) => (<tr key={i}><td>{String(row.pickup_zone)}</td><td style={{ fontWeight: 'bold' }}>{Number(row.trips).toLocaleString()}</td><td>${Number(row.avg_fare).toFixed(2)}</td></tr>))}</tbody></table></div></IonCardContent></IonCard>
          <IonCard style={{ margin: '16px' }}><IonCardHeader><IonCardTitle>🛣️ Longest Trips</IonCardTitle></IonCardHeader><IonCardContent><div className="result-table"><table><thead><tr><th>Distance</th><th>Amount</th><th>Route</th></tr></thead><tbody>{queryCache.longestTrips.map((trip, i) => (<tr key={i}><td style={{ fontWeight: 'bold' }}>{Number(trip.trip_distance).toFixed(1)} mi</td><td style={{ color: 'var(--ion-color-success)' }}>${Number(trip.total_amount).toFixed(2)}</td><td style={{ fontSize: '0.75rem' }}>{String(trip.pickup_zone)} → {String(trip.dropoff_zone)}</td></tr>))}</tbody></table></div></IonCardContent></IonCard>
        </>)}
        <div className="ion-padding ion-text-center" style={{ paddingBottom: '100px' }}><IonText color="medium"><p style={{ fontSize: '0.75rem' }}>All data is stored and queried locally using DuckDB.<br />No internet connection required. 100% offline analytics.</p></IonText></div>
      </IonContent>
    </IonPage>
  );
};

export default TaxiTab;
