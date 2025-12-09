// Minimal DuckPGQ extension declaration for static loading on Android
// Uses the same interface as the upstream DuckPGQ extension but avoids pulling the full source tree
#pragma once

#include "duckdb/main/extension.hpp"

namespace duckdb {

class DuckpgqExtension : public Extension {
public:
    void Load(ExtensionLoader &loader) override;
    std::string Name() override;
};

} // namespace duckdb
