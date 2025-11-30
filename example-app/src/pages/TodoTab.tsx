import { useState, useEffect, useCallback } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel,
  IonCheckbox, IonButton, IonInput, IonIcon, IonItemSliding, IonItemOptions,
  IonItemOption, IonFab, IonFabButton, IonBadge, IonText, IonRefresher,
  IonRefresherContent, useIonAlert, useIonToast,
} from '@ionic/react';
import type { RefresherEventDetail } from '@ionic/react';
import { add, trash, refresh, checkmarkDone } from 'ionicons/icons';
import { duckdb, TODO_DB } from '../services/duckdb';

interface Todo { id: number; title: string; completed: boolean; created_at: string; }

const TodoTab: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState('');
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();

  const loadTodos = useCallback(async () => {
    try {
      const result = await duckdb.query<Todo>(TODO_DB, 'SELECT * FROM todos ORDER BY created_at DESC');
      setTodos(result.values);
    } catch (error) { console.error('Load error:', error); }
  }, []);

  const initDatabase = useCallback(async () => {
    try {
      const ver = await duckdb.getVersion();
      setVersion(ver);
      await duckdb.execute(TODO_DB, `CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, title VARCHAR NOT NULL, completed BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE SEQUENCE IF NOT EXISTS todos_id_seq;`);
      await loadTodos();
    } catch (error) {
      console.error('Init error:', error);
      presentToast({ message: `Error: ${(error as Error).message}`, duration: 3000, color: 'danger' });
    } finally { setLoading(false); }
  }, [presentToast, loadTodos]);

  const addTodo = async () => {
    const title = newTodo.trim();
    if (!title) return;
    try {
      const seqResult = await duckdb.query<{ next_id: number }>(TODO_DB, "SELECT nextval('todos_id_seq') as next_id");
      const nextId = seqResult.values[0].next_id;
      await duckdb.run(TODO_DB, 'INSERT INTO todos (id, title) VALUES ($1, $2)', [nextId, title]);
      setNewTodo('');
      await loadTodos();
      presentToast({ message: 'Todo added!', duration: 1500, color: 'success' });
    } catch (error) {
      console.error('Add error:', error);
      presentToast({ message: `Error: ${(error as Error).message}`, duration: 3000, color: 'danger' });
    }
  };

  const toggleTodo = async (id: number, completed: boolean) => {
    try {
      await duckdb.run(TODO_DB, 'UPDATE todos SET completed = $1 WHERE id = $2', [completed, id]);
      await loadTodos();
    } catch (error) { console.error('Toggle error:', error); }
  };

  const deleteTodo = async (id: number) => {
    try {
      await duckdb.run(TODO_DB, 'DELETE FROM todos WHERE id = $1', [id]);
      await loadTodos();
      presentToast({ message: 'Todo deleted', duration: 1500 });
    } catch (error) { console.error('Delete error:', error); }
  };

  const clearCompleted = async () => {
    try {
      const changes = await duckdb.execute(TODO_DB, 'DELETE FROM todos WHERE completed = true');
      await loadTodos();
      presentToast({ message: `Cleared ${changes} completed todos`, duration: 1500, color: 'success' });
    } catch (error) { console.error('Clear error:', error); }
  };

  const resetDatabase = async () => {
    presentAlert({
      header: 'Reset Database',
      message: 'Are you sure you want to delete all todos? This cannot be undone.',
      buttons: ['Cancel', {
        text: 'Reset', role: 'destructive',
        handler: async () => {
          try { await duckdb.deleteDatabase(TODO_DB); await initDatabase(); presentToast({ message: 'Database reset', duration: 1500 }); }
          catch (error) { console.error('Reset error:', error); }
        },
      }],
    });
  };

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => { await loadTodos(); event.detail.complete(); };

  useEffect(() => { initDatabase(); }, [initDatabase]);

  const completedCount = todos.filter((t) => t.completed).length;
  const totalCount = todos.length;

  return (
    <IonPage>
      <IonHeader className="duckdb-header">
        <IonToolbar color="secondary">
          <IonTitle><span className="duckdb-logo">🦆</span>Todo List{version && <IonBadge className="version-badge">v{version}</IonBadge>}</IonTitle>
          <IonButton slot="end" fill="clear" color="light" onClick={resetDatabase}><IonIcon icon={refresh} /></IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}><IonRefresherContent /></IonRefresher>
        <div className="ion-padding ion-text-center">
          <IonText color="medium">{completedCount} of {totalCount} completed</IonText>
          {completedCount > 0 && (<IonButton size="small" fill="clear" onClick={clearCompleted}><IonIcon icon={checkmarkDone} slot="start" />Clear Completed</IonButton>)}
        </div>
        <div className="ion-padding">
          <IonItem>
            <IonInput placeholder="What needs to be done?" value={newTodo} onIonInput={(e) => setNewTodo(e.detail.value || '')} onKeyPress={(e) => e.key === 'Enter' && addTodo()} />
            <IonButton slot="end" onClick={addTodo} disabled={!newTodo.trim()}><IonIcon icon={add} /></IonButton>
          </IonItem>
        </div>
        {loading ? (<div className="ion-padding ion-text-center"><IonText color="medium">Loading...</IonText></div>) : todos.length === 0 ? (
          <div className="empty-state"><IonIcon icon={checkmarkDone} color="medium" /><p>No todos yet!</p><p>Add one above to get started.</p></div>
        ) : (
          <IonList>
            {todos.map((todo) => (
              <IonItemSliding key={todo.id}>
                <IonItem className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                  <IonCheckbox slot="start" checked={todo.completed} onIonChange={(e) => toggleTodo(todo.id, e.detail.checked)} />
                  <IonLabel><h2>{todo.title}</h2><p>{new Date(todo.created_at).toLocaleDateString()}</p></IonLabel>
                </IonItem>
                <IonItemOptions side="end"><IonItemOption color="danger" onClick={() => deleteTodo(todo.id)}><IonIcon slot="icon-only" icon={trash} /></IonItemOption></IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
        )}
        <IonFab vertical="bottom" horizontal="end" slot="fixed"><IonFabButton onClick={() => document.querySelector('ion-input')?.setFocus()}><IonIcon icon={add} /></IonFabButton></IonFab>
      </IonContent>
    </IonPage>
  );
};

export default TodoTab;
