import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  QueryConstraint,
  query,
  type DocumentData,
  type DocumentSnapshot,
  limit,
  orderBy,
  startAfter,
} from "firebase/firestore";

type WithId<T> = T & { id: string };

export class FirestoreService {
  static async add<T>(collectionName: string, data: T): Promise<string> {
    const colRef = collection(db, collectionName);
    const docRef = await addDoc(colRef, data as DocumentData);
    return docRef.id;
  }

  static async getAll<T>(
    collectionName: string,
    constraints: QueryConstraint[] = []
  ): Promise<WithId<T>[]> {
    const colRef = collection(db, collectionName);
    const q = constraints.length ? query(colRef, ...constraints) : colRef;
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
  }

  static async getById<T>(
    collectionName: string,
    id: string
  ): Promise<WithId<T> | null> {
    const docRef = doc(db, collectionName, id);
    const snapshot = await getDoc(docRef);
    return snapshot.exists()
      ? { id: snapshot.id, ...(snapshot.data() as T) }
      : null;
  }

  static async update<T>(
    collectionName: string,
    id: string,
    data: Partial<T>
  ): Promise<void> {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, data as DocumentData);
  }

  static async delete(collectionName: string, id: string): Promise<void> {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  }

  static async set<T>(
    collectionName: string,
    id: string,
    data: T
  ): Promise<void> {
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, data as DocumentData);
  }

  /**
   * Lee una página de documentos usando paginación por cursor.
   * - orderByField: campo por el que ordenar (recomendado para cursor consistente)
   * - order: 'asc' | 'desc' (por defecto 'asc')
   * - startAfterSnapshot: pasa el DocumentSnapshot retornado en nextCursor para la siguiente página
   *
   * Retorna los documentos y nextCursor (DocumentSnapshot) o null si no hay más páginas.
   */
  static async getPaged<T>(
    collectionName: string,
    pageSize: number,
    options?: {
      orderByField?: string;
      order?: "asc" | "desc";
      startAfterSnapshot?: DocumentSnapshot<DocumentData>;
      constraints?: QueryConstraint[]; // NUEVO: where/range extras
    }
  ): Promise<{
    data: (T & { id: string })[];
    nextCursor: DocumentSnapshot<DocumentData> | null;
  }> {
    const colRef = collection(db, collectionName);
    const constraints: QueryConstraint[] = [];

    if (options?.constraints?.length) {
      constraints.push(...options.constraints);
    }

    if (options?.orderByField) {
      constraints.push(orderBy(options.orderByField, options.order ?? "asc"));
    }

    constraints.push(limit(pageSize));

    if (options?.startAfterSnapshot) {
      constraints.push(startAfter(options.startAfterSnapshot));
    }

    const q = query(colRef, ...constraints);
    const snapshot = await getDocs(q);

    const data = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
    const lastDoc = snapshot.docs.length
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;

    const nextCursor = lastDoc && data.length === pageSize ? lastDoc : null;

    return { data, nextCursor };
  }
}
