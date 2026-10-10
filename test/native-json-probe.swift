import Foundation

// Compiled alongside the unmodified Anywhere MITMJSONPatch implementation and
// its operation enum extracted by verify-native-json.mjs. No APP source edits.
@main struct NativeJSONProbe {
    struct Entry: Decodable { let input: String; let operations: [[String]] }
    static func main() throws {
        let entries = try JSONDecoder().decode([Entry].self, from: FileHandle.standardInput.readDataToEndOfFile())
        let outputs = entries.map { entry in
            let operations = entry.operations.compactMap { fields -> MITMJSONPatch.CompiledOperation? in
                guard fields.count >= 2 else { return nil }
                switch fields[0] {
                case "delete": return MITMJSONPatch.compile(.delete(path: fields[1]))
                case "add" where fields.count == 3: return MITMJSONPatch.compile(.add(path: fields[1], value: fields[2]))
                default: return nil
                }
            }
            return String(decoding: MITMJSONPatch.applyAll(operations, to: Data(entry.input.utf8)), as: UTF8.self)
        }
        FileHandle.standardOutput.write(try JSONEncoder().encode(outputs))
    }
}
