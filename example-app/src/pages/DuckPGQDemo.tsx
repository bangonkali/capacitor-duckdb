import React, { useEffect, useState } from 'react';
import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonLoading,
    IonToast,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonText,
} from '@ionic/react';
import { playOutline, refreshOutline } from 'ionicons/icons';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, MarkerType, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CapacitorDuckDb } from '@bangonkali/capacitor-duckdb';

const DB_NAME = 'duckpgq_demo';

const DuckPGQDemo: React.FC = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);

    // Initial setup
    useEffect(() => {
        initializeDemo();
    }, []);

    const initializeDemo = async () => {
        try {
            setLoading(true);

            // Delete existing database to start fresh (avoids DROP PROPERTY GRAPH issues)
            try {
                await CapacitorDuckDb.deleteDatabase({ database: DB_NAME });
            } catch (e) {
                // Ignore error if DB doesn't exist
            }

            // Open the database connection
            await CapacitorDuckDb.open({ database: DB_NAME });

            // Create tables and sample data
            const setupQuery = `
                CREATE TABLE Person (personId BIGINT PRIMARY KEY, name VARCHAR);
                CREATE TABLE Account (accountId BIGINT PRIMARY KEY, personId BIGINT);
                CREATE TABLE Transfer (fromId BIGINT, toId BIGINT, amount DOUBLE);

                -- Insert Fraud Ring Data
                INSERT INTO Person VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie'), (4, 'David');
                
                INSERT INTO Account VALUES 
                    (101, 1), -- Alice's Account
                    (102, 2), -- Bob's Account
                    (103, 3), -- Charlie's Account
                    (104, 4); -- David's Account

                INSERT INTO Transfer VALUES
                    (101, 102, 1000), -- Alice -> Bob
                    (102, 103, 1000), -- Bob -> Charlie
                    (103, 101, 1000), -- Charlie -> Alice (Cycle!)
                    (101, 104, 500);  -- Alice -> David (Legit)
            `;

            console.log('Executing setup query...');
            await CapacitorDuckDb.execute({ database: DB_NAME, statements: setupQuery });

            // Create Property Graph
            const graphQuery = `
                CREATE PROPERTY GRAPH finbench 
                VERTEX TABLES (
                    Person,
                    Account
                )
                EDGE TABLES (
                    Transfer 
                        SOURCE KEY (fromId) REFERENCES Account (accountId)
                        DESTINATION KEY (toId) REFERENCES Account (accountId)
                );
            `;
            console.log('Executing graph query...');
            await CapacitorDuckDb.execute({ database: DB_NAME, statements: graphQuery });

            setInitialized(true);
            await visualizeGraph();
        } catch (error) {
            console.error('Setup failed:', error);
            setMessage('Failed to initialize demo: ' + (error as any).message);
        } finally {
            setLoading(false);
        }
    };

    const visualizeGraph = async () => {
        try {
            // Fetch Nodes
            const accountsRes = await CapacitorDuckDb.query({ database: DB_NAME, statement: "SELECT * FROM Account" });
            const personsRes = await CapacitorDuckDb.query({ database: DB_NAME, statement: "SELECT * FROM Person" });

            // Fetch Edges
            const transfersRes = await CapacitorDuckDb.query({ database: DB_NAME, statement: "SELECT * FROM Transfer" });

            const newNodes: Node[] = [];
            const newEdges: Edge[] = [];

            // Map Persons
            personsRes.values?.forEach((p: any, i: number) => {
                newNodes.push({
                    id: `p-${p.personId}`,
                    data: { label: `Person: ${p.name}` },
                    position: { x: 100 + (i * 150), y: 50 },
                    style: { background: '#e0e0e0', borderRadius: '50%', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }
                });
            });

            // Map Accounts
            accountsRes.values?.forEach((a: any, i: number) => {
                newNodes.push({
                    id: `a-${a.accountId}`,
                    data: { label: `Acct: ${a.accountId}` },
                    position: { x: 100 + (i * 150), y: 200 },
                    style: { background: '#fff', border: '1px solid #777', padding: 10 }
                });

                // Link Person to Account (Visual only, not in graph query for simplicity of demo visualization)
                newEdges.push({
                    id: `own-${a.personId}-${a.accountId}`,
                    source: `p-${a.personId}`,
                    target: `a-${a.accountId}`,
                    type: 'straight',
                    style: { stroke: '#aaa', strokeDasharray: '5,5' },
                    animated: false,
                });
            });

            // Map Transfers
            transfersRes.values?.forEach((t: any, i: number) => {
                newEdges.push({
                    id: `t-${i}`,
                    source: `a-${t.fromId}`,
                    target: `a-${t.toId}`,
                    label: `$${t.amount}`,
                    markerEnd: { type: MarkerType.ArrowClosed },
                    animated: true,
                });
            });

            setNodes(newNodes);
            setEdges(newEdges);

        } catch (error) {
            console.error('Visualization failed:', error);
        }
    };

    const runFraudDetection = async () => {
        try {
            setLoading(true);

            // PGQ Query to find cycles
            // Finding paths from an account back to itself
            const query = `
                FROM GRAPH_TABLE(finbench
                    MATCH (a:Account)-[t:Transfer]->{1,3}(a)
                    COLUMNS (a.accountId)
                )
            `;

            const result = await CapacitorDuckDb.query({ database: DB_NAME, statement: query });

            if (result.values && result.values.length > 0) {
                setMessage(`Fraud Ring Detected! Found ${result.values.length} cyclic transactions.`);

                // Highlight the cycle
                const cyclicAccountIds = new Set(result.values.map((r: any) => r.accountId));

                setNodes((nds) =>
                    nds.map((node) => {
                        if (node.id.startsWith('a-') && cyclicAccountIds.has(parseInt(node.id.split('-')[1]))) {
                            return {
                                ...node,
                                style: { ...node.style, background: '#ffcccc', border: '2px solid red' }
                            };
                        }
                        return node;
                    })
                );

                setEdges((eds) =>
                    eds.map((edge) => {
                        // Heuristic: if both source and target are in the cycle, highlight edge
                        const sourceId = parseInt(edge.source.split('-')[1]);
                        const targetId = parseInt(edge.target.split('-')[1]);

                        if (cyclicAccountIds.has(sourceId) && cyclicAccountIds.has(targetId)) {
                            return {
                                ...edge,
                                style: { ...edge.style, stroke: 'red', strokeWidth: 2 },
                                animated: true
                            };
                        }
                        return edge;
                    })
                );

            } else {
                setMessage('No fraud rings detected.');
            }

        } catch (error) {
            console.error('Analysis failed:', error);
            setMessage('Analysis failed: ' + (error as any).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar color="tertiary">
                    <IonButtons slot="start">
                        <IonBackButton defaultHref="/demos" />
                    </IonButtons>
                    <IonTitle>DuckPGQ Fraud Detection</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={initializeDemo}>
                            <IonIcon icon={refreshOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <div style={{ height: '60vh', width: '100%', borderBottom: '1px solid #ccc' }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        fitView
                    >
                        <Background />
                        <Controls />
                    </ReactFlow>
                </div>

                <div className="ion-padding">
                    <IonCard>
                        <IonCardHeader>
                            <IonCardTitle>Financial Forensics</IonCardTitle>
                        </IonCardHeader>
                        <IonCardContent>
                            <p>
                                This demo uses <b>DuckPGQ</b> to analyze transaction graphs.
                                We are looking for circular money transfers (A -&gt; B -&gt; C -&gt; A), which often indicate money laundering or fraud rings.
                            </p>
                            <br />
                            <IonButton expand="block" color="danger" onClick={runFraudDetection} disabled={!initialized}>
                                <IonIcon slot="start" icon={playOutline} />
                                Detect Fraud Rings
                            </IonButton>
                        </IonCardContent>
                    </IonCard>

                    {/* Query Explanation */}
                    <IonCard color="light">
                        <IonCardContent>
                            <IonText color="medium">
                                <code>
                                    MATCH (a:Account)-[t:Transfer]-&gt;{'{1,3}'}(a)
                                </code>
                            </IonText>
                        </IonCardContent>
                    </IonCard>
                </div>

                <IonLoading isOpen={loading} message="Processing Graph..." />
                <IonToast
                    isOpen={!!message}
                    message={message || ''}
                    duration={3000}
                    onDidDismiss={() => setMessage(null)}
                />
            </IonContent>
        </IonPage>
    );
};

export default DuckPGQDemo;
