import React from 'react';
import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonNote,
} from '@ionic/react';
import {
    globeOutline,
    analyticsOutline,
    checkboxOutline,
    terminalOutline,
    chevronForwardOutline,
    gitNetworkOutline,
} from 'ionicons/icons';

const DemosTab: React.FC = () => {
    return (
        <IonPage>
            <IonHeader>
                <IonToolbar color="primary">
                    <IonTitle>Demos</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <IonList inset>
                    <IonItem button routerLink="/duckpgq" detail={false}>
                        <IonIcon slot="start" icon={gitNetworkOutline} color="tertiary" />
                        <IonLabel>
                            <h2>Graph Analysis</h2>
                            <p>Fraud detection with DuckPGQ</p>
                        </IonLabel>
                        <IonIcon slot="end" icon={chevronForwardOutline} color="medium" />
                    </IonItem>

                    <IonItem button routerLink="/spatial" detail={false}>
                        <IonIcon slot="start" icon={globeOutline} color="primary" />
                        <IonLabel>
                            <h2>Spatial Analysis</h2>
                            <p>Geospatial queries and visualization</p>
                        </IonLabel>
                        <IonIcon slot="end" icon={chevronForwardOutline} color="medium" />
                    </IonItem>

                    <IonItem button routerLink="/taxi" detail={false}>
                        <IonIcon slot="start" icon={analyticsOutline} color="warning" />
                        <IonLabel>
                            <h2>NYC Taxi Analytics</h2>
                            <p>Large dataset aggregation</p>
                        </IonLabel>
                        <IonIcon slot="end" icon={chevronForwardOutline} color="medium" />
                    </IonItem>

                    <IonItem button routerLink="/todo" detail={false}>
                        <IonIcon slot="start" icon={checkboxOutline} color="success" />
                        <IonLabel>
                            <h2>Todo List</h2>
                            <p>Simple CRUD operations</p>
                        </IonLabel>
                        <IonIcon slot="end" icon={chevronForwardOutline} color="medium" />
                    </IonItem>

                    <IonItem button routerLink="/query" detail={false}>
                        <IonIcon slot="start" icon={terminalOutline} color="dark" />
                        <IonLabel>
                            <h2>SQL Playground</h2>
                            <p>Execute custom SQL queries</p>
                        </IonLabel>
                        <IonIcon slot="end" icon={chevronForwardOutline} color="medium" />
                    </IonItem>
                </IonList>

                <div className="ion-padding ion-text-center">
                    <IonNote>
                        Select a demo to explore DuckDB capabilities
                    </IonNote>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default DemosTab;
