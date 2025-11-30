import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { checkboxOutline, analyticsOutline, terminalOutline, globeOutline, flaskOutline, settingsOutline } from 'ionicons/icons';

import TodoTab from './pages/TodoTab';
import TaxiTab from './pages/TaxiTab';
import QueryTab from './pages/QueryTab';
import SpatialTab from './pages/SpatialTab';
import TestTab from './pages/TestTab';
import SettingsTab from './pages/SettingsTab';

// Spatial demo pages
import ConstructorsDemo from './pages/spatial/ConstructorsDemo';
import PredicatesDemo from './pages/spatial/PredicatesDemo';
import MeasurementsDemo from './pages/spatial/MeasurementsDemo';
import ProcessingDemo from './pages/spatial/ProcessingDemo';
import TransformsDemo from './pages/spatial/TransformsDemo';
import AggregatesDemo from './pages/spatial/AggregatesDemo';
import LineOpsDemo from './pages/spatial/LineOpsDemo';
import IODemo from './pages/spatial/IODemo';

const App: React.FC = () => {
  return (
    <IonApp>
      <IonReactRouter>
        <IonTabs>
          <IonRouterOutlet>
            {/* Main tabs */}
            <Route exact path="/spatial">
              <SpatialTab />
            </Route>
            <Route exact path="/todo">
              <TodoTab />
            </Route>
            <Route exact path="/taxi">
              <TaxiTab />
            </Route>
            <Route exact path="/query">
              <QueryTab />
            </Route>
            <Route exact path="/test">
              <TestTab />
            </Route>
            <Route exact path="/settings">
              <SettingsTab />
            </Route>
            
            {/* Spatial demo pages */}
            <Route exact path="/spatial/constructors">
              <ConstructorsDemo />
            </Route>
            <Route exact path="/spatial/predicates">
              <PredicatesDemo />
            </Route>
            <Route exact path="/spatial/measurements">
              <MeasurementsDemo />
            </Route>
            <Route exact path="/spatial/processing">
              <ProcessingDemo />
            </Route>
            <Route exact path="/spatial/transforms">
              <TransformsDemo />
            </Route>
            <Route exact path="/spatial/aggregates">
              <AggregatesDemo />
            </Route>
            <Route exact path="/spatial/lineops">
              <LineOpsDemo />
            </Route>
            <Route exact path="/spatial/io">
              <IODemo />
            </Route>
            
            {/* Default route - Spatial demo is the showcase */}
            <Route exact path="/">
              <Redirect to="/spatial" />
            </Route>
          </IonRouterOutlet>

          <IonTabBar slot="bottom">
            <IonTabButton tab="spatial" href="/spatial">
              <IonIcon icon={globeOutline} />
              <IonLabel>Spatial</IonLabel>
            </IonTabButton>
            <IonTabButton tab="taxi" href="/taxi">
              <IonIcon icon={analyticsOutline} />
              <IonLabel>NYC Taxi</IonLabel>
            </IonTabButton>
            <IonTabButton tab="todo" href="/todo">
              <IonIcon icon={checkboxOutline} />
              <IonLabel>Todo</IonLabel>
            </IonTabButton>
            <IonTabButton tab="query" href="/query">
              <IonIcon icon={terminalOutline} />
              <IonLabel>SQL</IonLabel>
            </IonTabButton>
            <IonTabButton tab="test" href="/test">
              <IonIcon icon={flaskOutline} />
              <IonLabel>Tests</IonLabel>
            </IonTabButton>
            <IonTabButton tab="settings" href="/settings">
              <IonIcon icon={settingsOutline} />
              <IonLabel>Settings</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
