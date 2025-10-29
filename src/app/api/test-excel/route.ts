import { NextResponse } from "next/server";
import * as XLSX from 'xlsx';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET() {
    try {
        const dataDir = join(process.cwd(), 'public');
        console.log('Data directory:', dataDir);
        console.log('Directory exists:', existsSync(dataDir));

        const files = ['3103.xlsx', 'Expense Code Mapping Logic.xlsx'];
        const results = {};

        for (const fileName of files) {
            const filePath = join(dataDir, fileName);
            console.log('Checking file:', filePath);
            console.log('File exists:', existsSync(filePath));

            if (existsSync(filePath)) {
                try {
                    const fileBuffer = require('fs').readFileSync(filePath);
                    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
                    results[fileName] = {
                        success: true,
                        sheets: workbook.SheetNames,
                        sheetCount: workbook.SheetNames.length
                    };
                } catch (error) {
                    results[fileName] = {
                        success: false,
                        error: error.message
                    };
                }
            } else {
                results[fileName] = {
                    success: false,
                    error: 'File not found'
                };
            }
        }

        return NextResponse.json({
            dataDir,
            results,
            cwd: process.cwd()
        });
    } catch (error) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
