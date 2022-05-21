#!/usr/bin/env node

// Dependencies
import * as fs from "fs"
import { program } from "commander"
import { Luraph, LuraphTargetVersionsKeys } from "luraph-extended";
import path from "path";
import { ILuraphOptions } from "./interfaces/ILuraphOptions";

//
function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

// Vars
const PackageData = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"))

// Program Data
program
    .name(PackageData.name)
    .description(PackageData.description)
    .version(PackageData.version);

// Obfuscate a command
{
    const ObfuscateCommand = program.command("obfuscate")

    // Arguments
    ObfuscateCommand.argument("<input>", "the file to obfuscate")
    ObfuscateCommand.argument("<output>", "set where to output the obfuscated file")
    ObfuscateCommand.argument("<target>", "the target lua version")
    ObfuscateCommand.argument("<key>", "your api key / bearer auth")
    
    // Options
    ObfuscateCommand.option("-b, --bearer", "Use Bearer auth, instead of API Key", false)
    ObfuscateCommand.option("-dli, --disable-line-information", "Disables line information", false)
    ObfuscateCommand.option("-egcf, --enable-gc-fixes", "Enables GC fixes", false)
    ObfuscateCommand.option("-ivms, --intense-vm-structure", "Enables Intense VM Structure", false)
    ObfuscateCommand.option("-udb, --use-debug-library", "Use Debug Library", false)
    ObfuscateCommand.option("-vme, --vm-encryption", "Enable VM Encryption", false)
    
    // Main functionality
    ObfuscateCommand.action(async (InputPath, OutputPath, Target, Key, Options: ILuraphOptions) => {
        // Validify target
        if (!LuraphTargetVersionsKeys.includes(Target))
            throw(new Error(`Invalid target. Must be one of the following: ${LuraphTargetVersionsKeys.join(" | ")}`))
    
        // Grab the input
        const Script = fs.readFileSync(InputPath, "utf-8")
    
        // Send the request
        const LuraphAPI = new Luraph(Options.bearer ? "Bearer" : "API", Key)
        const { recommendedId } = await LuraphAPI.getNodes()
        const { jobId } = await LuraphAPI.createNewJob(recommendedId, Script, path.basename(OutputPath), {
            DISABLE_LINE_INFORMATION: Options.disableLineInformation,
            ENABLE_GC_FIXES: Options.enableGcFixes,
            INTENSE_VM_STRUCTURE: Options.intenseVmStructure,
            TARGET_VERSION: Target,
            USE_DEBUG_LIBRARY: Options.useDebugLibrary,
            VM_ENCRYPTION: Options.vmEncryption
        })
    
        //
        console.log(`Sent obfuscation request. Job Id: ${jobId}`)
    
        // Wait until the job is done
        while (true){
            const { success } = await LuraphAPI.getJobStatus(jobId)
            if (success) break
            await delay(1)
        }
        
        // Download it
        fs.writeFileSync(OutputPath, (await LuraphAPI.downloadResult(jobId)).data, {
            encoding: "utf-8"
        })
        console.log(`Obfuscation job done. Job Id: ${jobId}`)
    })
}

// Get a job status
{
    const StatusCommand = program.command("status")

    // Arguments
    StatusCommand.argument("<jobId>", "The job id of which you want to check on")
    StatusCommand.argument("<key>", "your api key / bearer auth")

    // Options
    StatusCommand.option("-b, --bearer", "Use Bearer auth, instead of API Key", false)

    // Main functionality
    StatusCommand.action(async (JobId, Key, Options) => {
        // Send the request
        const LuraphAPI = new Luraph(Options.bearer ? "Bearer" : "API", Key)
        const Result = await LuraphAPI.getJobStatus(JobId)

        //
        const Marker = Result.success ? "+" : "!"
        const Message = Result.success ? "Successfully obfuscated" : Result.error
        console.log(`[${Marker}] ${Message}`)
    })
}

// Get all of the nodes
{
    const NodesCommand = program.command("nodes")

    // Arguments
    NodesCommand.argument("<key>", "your api key / bearer auth")

    // Options
    NodesCommand.option("-b, --bearer", "Use Bearer auth, instead of API Key", false)

    // Main functionality
    NodesCommand.action(async (Key, Options) => {
        // Send the request
        const LuraphAPI = new Luraph(Options.bearer ? "Bearer" : "API", Key)
        const Result = await LuraphAPI.getNodes()

        //
        console.log(`Recommended Id: ${Result.recommendedId}`)

        //
        for (const [node, data] of Object.entries(Result.nodes)){
            console.log(`${node} - ${data.cpuUsage}% CPU`)
        }
    })
}

// Parse it all
program.parse(process.argv)