# Local RAG Tokenizer/Embedding Plan for Capacitor DuckDB

## Overview

This document outlines the plan to implement a local RAG (Retrieval Augmented Generation) tool that:
1. Allows users to select PDF files
2. Extracts and chunks text from PDFs
3. Tokenizes/embeds the text using on-device embedding models (default: **EmbeddingGemma-300m**)
4. Stores embeddings in DuckDB VSS for efficient similarity search
5. Supports multiple embedding model options via unified LiteRT engine
6. Pre-downloads models and packages them with the app

## Target Device

**Samsung Galaxy S10** (2019)
- Chipset: Exynos 9820 / Snapdragon 855
- RAM: 8GB
- CPU: Octa-core (2.7GHz + 2.3GHz + 1.9GHz)
- GPU: Mali-G76 MP12 / Adreno 640
- Android Version: 10-13 (depending on updates)

This is a mid-to-high-end device from 2019, so we need efficient models that balance quality with performance.

---

## Example App Structure (Updated)

The example app tabs have been streamlined to focus on core functionality:

### Tab Layout

| Tab | Icon | Description |
|-----|------|-------------|
| **Spatial** | 🌍 `globeOutline` | Interactive spatial demo with Natural Earth data |
| **Others** | 📋 `appsOutline` | Demo list with links to various feature demos |
| **Settings** | ⚙️ `settingsOutline` | App configuration, model selection, storage info |

### Others Tab → Demo List

The Others tab serves as a hub for all demos:

| Demo | Page Route | Description |
|------|------------|-------------|
| **NYC Taxi Demo** | `/demos/taxi` | Analytics with 1M+ taxi trip records |
| **TODO Demo** | `/demos/todo` | CRUD operations with DuckDB |
| **SQL Demo** | `/demos/sql` | Interactive SQL query console |
| **Tests** | `/demos/tests` | Integration test suite |
| **RAG Demo** | `/demos/rag` | PDF embedding & semantic search (NEW) |

### Route Structure

```
/spatial                    → SpatialTab (default)
/spatial/constructors       → ConstructorsDemo
/spatial/predicates         → PredicatesDemo
/spatial/measurements       → MeasurementsDemo
/spatial/processing         → ProcessingDemo
/spatial/transforms         → TransformsDemo
/spatial/aggregates         → AggregatesDemo
/spatial/lineops            → LineOpsDemo
/spatial/io                 → IODemo

/others                     → OthersTab (demo list)
/demos/taxi                 → TaxiTab
/demos/todo                 → TodoTab
/demos/sql                  → QueryTab
/demos/tests                → TestTab
/demos/rag                  → RAGTab (NEW)

/settings                   → SettingsTab
```

---

## Primary Default: `EmbeddingGemma-300m`

**EmbeddingGemma-300m** is the **default embedding model** because:

### Why EmbeddingGemma-300m as Default?

1. **Best-in-class Quality**: Highest MTEB score for models under 500M params
2. **Google Official Support**: Designed for on-device, works with LiteRT
3. **Multilingual**: 100+ language support out of the box
4. **Matryoshka Embeddings**: Flexible output dimensions (256, 384, or 768)
5. **Future-Proof**: Latest architecture, actively maintained
6. **Efficient with Quantization**: <200MB RAM with INT8 quantization

### Supported Alternative Models (Same LiteRT Engine)

Users can switch to these models in Settings, all using the same LiteRT inference engine:

| Model | Size | Embedding Dim | Speed | Quality | Default |
|-------|------|---------------|-------|---------|---------|
| **EmbeddingGemma-300m** | 308M (~200MB INT8) | 256/384/768 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **DEFAULT** |
| **all-MiniLM-L6-v2** | 22.7M (~25MB INT8) | 384 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | |
| **bge-small-en-v1.5** | 33.4M (~35MB INT8) | 384 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | |
| **e5-small-v2** | 33.4M (~35MB INT8) | 384 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | |

### Performance Estimates on Galaxy S10

| Model | Inference Time (per chunk) | RAM Usage | APK Size Impact |
|-------|---------------------------|-----------|-----------------|
| EmbeddingGemma-300m (INT8) | ~150-300ms | ~300MB | +200MB |
| all-MiniLM-L6-v2 (INT8) | ~30-60ms | ~100MB | +25MB |
| bge-small-en-v1.5 (INT8) | ~50-100ms | ~120MB | +35MB |
| e5-small-v2 (INT8) | ~50-100ms | ~120MB | +35MB |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Ionic/Capacitor App                      │
│    Tabs: Spatial | Others | Settings                        │
│         PDF Selection → Text Extraction → UI Display        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Capacitor Plugin Layer                    │
│          EmbeddingPlugin.java (new Capacitor plugin)        │
│      Methods: loadModel, embed, unloadModel, getModels      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  LiteRT (TensorFlow Lite)                   │
│            Unified engine for all embedding models          │
│         GPU delegate / NNAPI for hardware acceleration      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Pre-Downloaded Model Files                     │
│    embeddinggemma-300m.tflite (DEFAULT)                     │
│    all-minilm-l6-v2.tflite (alternative)                    │
│    bge-small-en-v1.5.tflite (alternative)                   │
│           Bundled in APK assets/models/                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  DuckDB VSS Extension                       │
│         Vector storage + HNSW similarity search             │
│              Already compiled with VSS enabled!             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 0: App Restructure (Pre-requisite)

1. **Update Tab Structure**
   - Remove individual tabs for Todo, Taxi, SQL, Tests
   - Create new "Others" tab as demo hub
   - Keep only: Spatial | Others | Settings

2. **Create OthersTab.tsx**
   ```typescript
   // List of demos with navigation
   const demos = [
     { name: 'NYC Taxi Demo', route: '/demos/taxi', icon: analyticsOutline, description: 'Analytics with 1M+ taxi trips' },
     { name: 'TODO Demo', route: '/demos/todo', icon: checkboxOutline, description: 'CRUD operations' },
     { name: 'SQL Demo', route: '/demos/sql', icon: terminalOutline, description: 'Interactive SQL console' },
     { name: 'Tests', route: '/demos/tests', icon: flaskOutline, description: 'Integration test suite' },
     { name: 'RAG Demo', route: '/demos/rag', icon: documentTextOutline, description: 'PDF semantic search' },
   ];
   ```

3. **Update App.tsx routes**
   - Move demo pages under `/demos/*` routes
   - Add Others tab with `appsOutline` icon

### Phase 1: Model Download Scripts (Week 1)

1. **Create model download script**
   **File:** `scripts/download-embedding-models.mjs`
   ```javascript
   // Downloads and converts models to TFLite format
   const MODELS = {
     'embeddinggemma-300m': {
       source: 'https://huggingface.co/google/embeddinggemma-300m',
       default: true,
       dimensions: [256, 384, 768],
     },
     'all-minilm-l6-v2': {
       source: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2',
       default: false,
       dimensions: [384],
     },
     'bge-small-en-v1.5': {
       source: 'https://huggingface.co/BAAI/bge-small-en-v1.5',
       default: false,
       dimensions: [384],
     },
   };
   ```

2. **Model conversion pipeline**
   - Download from HuggingFace
   - Convert to TFLite using `tf.lite.TFLiteConverter`
   - Apply INT8 quantization for size reduction
   - Export tokenizer vocabulary

3. **Package models in APK**
   ```
   android/src/main/assets/models/
   ├── embeddinggemma-300m/
   │   ├── model.tflite          # Quantized model
   │   ├── tokenizer.json        # SentencePiece/WordPiece config
   │   └── config.json           # Model metadata
   ├── all-minilm-l6-v2/
   │   ├── model.tflite
   │   ├── vocab.txt
   │   └── config.json
   └── bge-small-en-v1.5/
       ├── model.tflite
       ├── vocab.txt
       └── config.json
   ```

### Phase 2: LiteRT Integration (Week 2)

1. **Add LiteRT dependency**
   ```gradle
   // android/build.gradle
   dependencies {
       implementation 'com.google.ai.edge.litert:litert:1.2.0'
       implementation 'com.google.ai.edge.litert:litert-gpu:1.2.0'  // GPU acceleration
   }
   ```

2. **Create EmbeddingService.java**
   - Single unified engine for all models
   - Load model from assets
   - Tokenize input text using model-specific tokenizer
   - Run inference with GPU delegate when available
   - Return embedding vectors

3. **Capacitor Plugin Methods**
   ```typescript
   interface EmbeddingPlugin {
     // Model management
     loadModel(options: { 
       modelId?: 'embeddinggemma-300m' | 'all-minilm-l6-v2' | 'bge-small-en-v1.5';  // default: embeddinggemma-300m
       useGPU?: boolean;     // Hardware acceleration
       dimensions?: number;  // For EmbeddingGemma: 256, 384, or 768
     }): Promise<{ loaded: boolean; modelSize: number; dimensions: number }>;
     
     // Generate embeddings
     embed(options: { 
       texts: string[];
       normalize?: boolean;
     }): Promise<{ embeddings: number[][]; dimensions: number; inferenceTimeMs: number }>;
     
     // Cleanup
     unloadModel(): Promise<void>;
     
     // Get bundled models info
     getAvailableModels(): Promise<{ 
       models: Array<{
         id: string;
         name: string;
         sizeBytes: number;
         dimensions: number[];
         isDefault: boolean;
         isLoaded: boolean;
       }>;
       currentModel: string | null;
     }>;
   }
   ```

### Phase 3: PDF Text Extraction (Week 2)

1. **Add PDF parsing library** (Native Android)
   - Option A: **Apache PDFBox** (pure Java, works on Android)
   - Option B: **MuPDF** (native C, faster, smaller footprint)
   - Recommendation: **MuPDF** for performance

2. **Text Chunking Strategy**
   - Chunk size: 256-512 tokens (matches model max sequence length)
   - Overlap: 50-100 tokens for context continuity
   - Sentence boundary awareness

3. **Capacitor Plugin Methods**
   ```typescript
   interface PDFPlugin {
     extractText(options: { uri: string }): Promise<{ text: string; pageCount: number }>;
     extractChunks(options: { 
       uri: string; 
       chunkSize?: number; 
       overlap?: number 
     }): Promise<{ chunks: string[]; metadata: ChunkMetadata[] }>;
   }
   ```

### Phase 4: DuckDB VSS Integration (Week 3)

1. **Create VSS tables**
   ```sql
   -- Document storage
   CREATE TABLE documents (
       id INTEGER PRIMARY KEY,
       filename VARCHAR,
       file_uri VARCHAR,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   -- Chunk storage with embeddings (768-dim for EmbeddingGemma default)
   CREATE TABLE chunks (
       id INTEGER PRIMARY KEY,
       document_id INTEGER REFERENCES documents(id),
       chunk_index INTEGER,
       content VARCHAR,
       page_number INTEGER,
       embedding FLOAT[768],  -- EmbeddingGemma default dimension
       model_id VARCHAR,      -- Track which model generated the embedding
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   -- Create HNSW index for similarity search
   CREATE INDEX chunks_embedding_idx ON chunks USING HNSW (embedding)
   WITH (metric = 'cosine');
   ```

2. **Similarity search queries**
   ```sql
   -- Find top-k similar chunks
   SELECT 
       c.id,
       c.content,
       c.page_number,
       d.filename,
       array_cosine_similarity(c.embedding, $query_embedding) AS similarity
   FROM chunks c
   JOIN documents d ON c.document_id = d.id
   ORDER BY c.embedding <-> $query_embedding
   LIMIT 5;
   ```

### Phase 5: Settings & Model Selection UI (Week 4)

1. **Settings Page Updates**
   - **Embedding Model Section**
     - Current model indicator with badge
     - Model list with radio selection
     - Size/speed/quality comparison
     - Re-embed option when switching models
   - **Storage Info**
     - Model storage usage
     - Document storage usage
     - VSS index size
   - **Performance Settings**
     - GPU acceleration toggle
     - Embedding dimension selection (for EmbeddingGemma)
     - Batch size configuration

2. **Model Info Display**
   ```typescript
   interface ModelInfo {
     id: string;
     name: string;
     description: string;
     sizeBytes: number;
     dimensions: number[];
     supportedLanguages: string[];
     mtebScore: number;      // Quality benchmark
     isDefault: boolean;
     isLoaded: boolean;
   }
   ```

3. **RAG Demo Page** (`/demos/rag`)
   - PDF file picker
   - Processing progress indicator
   - Embedded document list
   - Semantic search input
   - Results display with similarity scores
   - Source chunk highlighting

---

## File Structure

```
capacitor-duckdb/
├── android/
│   ├── src/main/
│   │   ├── assets/
│   │   │   └── models/                    # Pre-downloaded models (bundled in APK)
│   │   │       ├── embeddinggemma-300m/   # DEFAULT
│   │   │       │   ├── model.tflite
│   │   │       │   ├── tokenizer.json
│   │   │       │   └── config.json
│   │   │       ├── all-minilm-l6-v2/
│   │   │       │   ├── model.tflite
│   │   │       │   ├── vocab.txt
│   │   │       │   └── config.json
│   │   │       └── bge-small-en-v1.5/
│   │   │           ├── model.tflite
│   │   │           ├── vocab.txt
│   │   │           └── config.json
│   │   ├── java/ph/com/regalado/capacitor/
│   │   │   ├── duckdb/              # Existing DuckDB plugin
│   │   │   ├── embedding/           # NEW: Embedding plugin
│   │   │   │   ├── EmbeddingPlugin.java
│   │   │   │   ├── EmbeddingService.java
│   │   │   │   ├── TokenizerService.java
│   │   │   │   ├── ModelManager.java
│   │   │   │   └── models/
│   │   │   │       ├── EmbeddingGemmaTokenizer.java
│   │   │   │       ├── BertTokenizer.java      # For MiniLM, BGE
│   │   │   │       └── BaseTokenizer.java
│   │   │   └── pdf/                 # NEW: PDF plugin
│   │   │       ├── PDFPlugin.java
│   │   │       └── PDFService.java
│   │   └── cpp/
│   │       └── mupdf/               # MuPDF native library (optional)
├── scripts/
│   ├── build-android.sh             # Existing DuckDB build
│   ├── download-embedding-models.mjs # NEW: Model download & conversion
│   └── prepare-demo-database.mjs    # Existing
├── src/
│   ├── definitions.ts               # Add EmbeddingPlugin interface
│   ├── embedding.ts                 # NEW: Embedding service wrapper
│   └── index.ts
├── example-app/
│   └── src/
│       ├── App.tsx                  # Updated: Spatial | Others | Settings
│       ├── pages/
│       │   ├── SpatialTab.tsx       # Existing
│       │   ├── OthersTab.tsx        # NEW: Demo list hub
│       │   ├── SettingsTab.tsx      # Updated: Model selection
│       │   ├── demos/               # NEW: Demos folder
│       │   │   ├── TaxiDemo.tsx     # Moved from TaxiTab
│       │   │   ├── TodoDemo.tsx     # Moved from TodoTab
│       │   │   ├── SQLDemo.tsx      # Moved from QueryTab
│       │   │   ├── TestsDemo.tsx    # Moved from TestTab
│       │   │   └── RAGDemo.tsx      # NEW: PDF semantic search
│       │   └── spatial/             # Existing spatial demos
│       └── services/
│           ├── ragService.ts        # NEW: RAG orchestration
│           └── embeddingService.ts  # NEW: Embedding API wrapper
└── docs/
    └── TOKENIZER_PLAN.md            # This file
```

---

## Model Sources & Conversion

### Pre-Downloaded Models (Bundled with APK)

| Model | Source | Format | Quantization |
|-------|--------|--------|--------------|
| **EmbeddingGemma-300m** | [google/embeddinggemma-300m](https://huggingface.co/google/embeddinggemma-300m) | TFLite | INT8 |
| **all-MiniLM-L6-v2** | [sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) | TFLite | INT8 |
| **bge-small-en-v1.5** | [BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) | TFLite | INT8 |

### Model Download Script

**File:** `scripts/download-embedding-models.mjs`

```javascript
#!/usr/bin/env node
/**
 * Downloads embedding models from HuggingFace, converts to TFLite, and quantizes.
 * 
 * Usage: node scripts/download-embedding-models.mjs [--model <id>] [--all]
 * 
 * Requirements:
 *   - Python 3.8+ with transformers, tensorflow, tf-keras
 *   - ~5GB disk space for temporary files
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MODELS = {
  'embeddinggemma-300m': {
    hfRepo: 'google/embeddinggemma-300m',
    tokenizerType: 'sentencepiece',
    default: true,
    dimensions: [256, 384, 768],
    expectedSizeMB: 200,
  },
  'all-minilm-l6-v2': {
    hfRepo: 'sentence-transformers/all-MiniLM-L6-v2',
    tokenizerType: 'wordpiece',
    default: false,
    dimensions: [384],
    expectedSizeMB: 25,
  },
  'bge-small-en-v1.5': {
    hfRepo: 'BAAI/bge-small-en-v1.5',
    tokenizerType: 'wordpiece',
    default: false,
    dimensions: [384],
    expectedSizeMB: 35,
  },
};

const OUTPUT_DIR = 'android/src/main/assets/models';

async function downloadAndConvert(modelId) {
  const model = MODELS[modelId];
  const outputPath = path.join(OUTPUT_DIR, modelId);
  
  console.log(`\n📥 Downloading ${modelId}...`);
  
  // 1. Download from HuggingFace
  // 2. Convert to TFLite
  // 3. Apply INT8 quantization
  // 4. Export tokenizer
  
  // Implementation details in actual script...
}

// Main execution...
```

---

## Tokenizer Implementation

### Unified Tokenizer Architecture

All models use the same `TokenizerService.java` interface with model-specific implementations:

```java
// Base interface
public interface Tokenizer {
    int[] encode(String text);
    int[] encode(String text, int maxLength, boolean padding);
    String decode(int[] tokens);
    int getVocabSize();
    int getMaxLength();
}

// Model-specific implementations
public class EmbeddingGemmaTokenizer implements Tokenizer {
    // SentencePiece tokenization
}

public class BertTokenizer implements Tokenizer {
    // WordPiece tokenization (for MiniLM, BGE, E5)
}
```

### Tokenizer Types by Model

| Model | Tokenizer Type | Vocab Size | Max Length |
|-------|---------------|------------|------------|
| EmbeddingGemma-300m | SentencePiece | 256,000 | 1024 |
| all-MiniLM-L6-v2 | WordPiece | 30,522 | 256 |
| bge-small-en-v1.5 | WordPiece | 30,522 | 512 |

### Java Implementation Approach

For simplicity and reliability, implement tokenizers in pure Java:

1. **SentencePiece (EmbeddingGemma)**
   - Parse `tokenizer.json` from HuggingFace
   - Implement BPE algorithm in Java
   - Handle special tokens: `<bos>`, `<eos>`, `<pad>`

2. **WordPiece (BERT-based models)**
   - Load `vocab.txt` vocabulary file
   - Implement WordPiece algorithm
   - Handle special tokens: `[CLS]`, `[SEP]`, `[PAD]`, `[UNK]`

---

## Google EmbeddingGemma-300m Deep Dive (Default Model)

**EmbeddingGemma-300m** is Google's official on-device embedding model and our **default choice**:

### Key Features

| Feature | Value |
|---------|-------|
| **Parameters** | 308M |
| **Architecture** | Gemma 3 Text Encoder |
| **Embedding Dimensions** | 256, 384, or 768 (Matryoshka) |
| **Max Sequence Length** | 1024 tokens |
| **Languages** | 100+ |
| **MTEB Score** | #1 under 500M params |
| **Quantized Size** | ~200MB (INT8) |
| **License** | Apache 2.0 |

### Matryoshka Embeddings

EmbeddingGemma supports variable output dimensions via Matryoshka Representation Learning:

```typescript
// User can choose dimension in Settings
await EmbeddingPlugin.loadModel({
  modelId: 'embeddinggemma-300m',
  dimensions: 384,  // Options: 256, 384, 768
  useGPU: true,
});
```

| Dimension | Quality | Speed | VSS Index Size |
|-----------|---------|-------|----------------|
| 256 | ⭐⭐⭐⭐ | Fastest | Smallest |
| 384 | ⭐⭐⭐⭐⭐ | Fast | Medium |
| 768 | ⭐⭐⭐⭐⭐ | Slower | Largest |

### Why Default?

1. **Best quality for mobile**: Highest MTEB score in its size class
2. **Google official**: Designed for LiteRT, well-tested on Android
3. **Multilingual**: Works with documents in any language
4. **Flexible dimensions**: User can trade quality for speed
5. **Future-proof**: Latest architecture, actively maintained

---

## Performance Optimization Tips

### 1. Batch Processing
```java
// Process multiple chunks in one inference call
float[][] embeddings = embeddingService.embed(chunks, /* batchSize */ 8);
```

### 2. LiteRT GPU Delegate
```java
// Enable GPU acceleration on compatible devices
GpuDelegate.Options delegateOptions = new GpuDelegate.Options();
delegateOptions.setInferencePreference(GpuDelegate.Options.INFERENCE_PREFERENCE_SUSTAINED_SPEED);
GpuDelegate gpuDelegate = new GpuDelegate(delegateOptions);

Interpreter.Options options = new Interpreter.Options();
options.addDelegate(gpuDelegate);
options.setNumThreads(4);
```

### 3. INT8 Quantization
```python
# Quantize models during download/conversion
import tensorflow as tf

converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_dir)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_types = [tf.int8]
tflite_model = converter.convert()
```

### 4. Caching Strategy
- Cache embeddings for frequently accessed documents in DuckDB
- Use dimension-based table schema for quick lookup
- Pre-compute embeddings during idle time
- Store document hash to detect content changes

### 5. Progressive Loading
- Show partial results while embedding completes
- Background thread (Kotlin Coroutines) for embedding
- Abort capability for user cancellation
- Progress callbacks to UI

### 6. Memory Management
```java
// Release model when not in use
public void unloadModel() {
    if (interpreter != null) {
        interpreter.close();
        interpreter = null;
    }
    if (gpuDelegate != null) {
        gpuDelegate.close();
        gpuDelegate = null;
    }
}
```

---

## Comparison with Alternatives

### vs. Firebase AI Logic (Cloud)
| Aspect | Local (This Plan) | Firebase AI |
|--------|-------------------|-------------|
| Privacy | ✅ All data on-device | ❌ Data sent to cloud |
| Offline | ✅ Works offline | ❌ Requires network |
| Cost | ✅ Free after download | 💰 Pay per inference |
| Quality | ⭐⭐⭐⭐⭐ (EmbeddingGemma) | ⭐⭐⭐⭐⭐ |
| Speed | ⭐⭐⭐⭐ (depends on device) | ⭐⭐⭐ (network latency) |

### vs. Gemini Nano (On-Device)
| Aspect | This Plan | Gemini Nano |
|--------|-----------|-------------|
| Availability | ✅ All Android 7+ devices | ❌ Pixel 8+ only |
| Model Choice | ✅ Multiple options | ❌ Google's choice |
| Control | ✅ Full control | ❌ API-driven |
| Embeddings | ✅ Direct vector output | ❌ LLM-focused |
| Setup | Medium complexity | Simple (when available) |

### vs. ONNX Runtime
| Aspect | LiteRT (Our Choice) | ONNX Runtime |
|--------|---------------------|--------------|
| Google Models | ✅ Native support | ⚠️ Conversion needed |
| GPU Delegate | ✅ Excellent | ⚠️ Limited on mobile |
| APK Size | ⭐⭐⭐⭐⭐ Smaller | ⭐⭐⭐ Larger |
| Android Docs | ✅ Extensive | ⭐⭐⭐ Good |
| Model Variety | ⭐⭐⭐ TFLite focused | ⭐⭐⭐⭐⭐ Wide support |

---

## Next Steps

### Immediate (Before Implementation)
1. **Review this plan**: Confirm EmbeddingGemma-300m as default is acceptable
2. **Choose embedding dimension**: Recommend 384-dim for balance of quality/speed
3. **PDF library selection**: Choose between PDFBox (pure Java) and MuPDF (native, faster)

### Phase 0: App Restructure
4. **Refactor App.tsx**: Reduce tabs from 6 to 3 (Spatial | Others | Settings)
5. **Create OthersTab.tsx**: Demo hub with links to all demos
6. **Move existing demos**: Taxi, Todo, Query, Test → `/pages/demos/`

### Phase 1: Model Infrastructure
7. **Create download script**: `scripts/download-embedding-models.mjs`
8. **Verify model sizes**: Ensure all 3 models fit in APK (~250MB total)
9. **Test LiteRT integration**: Basic inference test on Galaxy S10

### Phase 2-5: Implementation
10. **Follow implementation phases**: As outlined in this document
11. **Benchmark on Galaxy S10**: Document actual performance metrics
12. **Iterate based on results**: Adjust model selection or parameters

### Future Enhancements
- Add more embedding models (e5-small-v2, multilingual-e5-small)
- Support model download at runtime (for optional models)
- Implement model fine-tuning for domain-specific use cases
- Add cloud fallback option for higher-quality embeddings

---

## References

- [LiteRT (TensorFlow Lite) Android](https://ai.google.dev/edge/litert/android)
- [LiteRT GPU Delegate](https://ai.google.dev/edge/litert/android/delegates/gpu)
- [EmbeddingGemma on HuggingFace](https://huggingface.co/google/embeddinggemma-300m)
- [Sentence Transformers](https://www.sbert.net/)
- [DuckDB VSS Extension](https://duckdb.org/docs/extensions/vss)
- [HuggingFace Tokenizers](https://huggingface.co/docs/tokenizers/)
- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard)
- [Matryoshka Embeddings Paper](https://arxiv.org/abs/2205.13147)
- [SentencePiece](https://github.com/google/sentencepiece)
- [Apache PDFBox](https://pdfbox.apache.org/)
- [MuPDF](https://mupdf.com/)
