package reactor;

import com.univocity.parsers.tsv.TsvParser;
import com.univocity.parsers.tsv.TsvParserSettings;
import org.apache.solr.common.SolrInputDocument;
import org.javatuples.Pair;
import org.javatuples.Quartet;
import org.javatuples.Sextet;


import java.io.File;
import java.util.*;

/**
 * Created by jorgeluis on 20/05/16.
 */
class FileParser {
    private TsvParser parser;

    FileParser(){
        TsvParserSettings settings = new TsvParserSettings();
        //the file used here uses '\n' as the line separator sequence.
        //the line separator sequence is defined here to ensure systems such as MacOS and Windows
        //are able to process this file correctly (MacOS uses '\r'; and Windows uses '\r\n').
        settings.getFormat().setLineSeparator("\n");

        // creates a TSV parser
        parser = new TsvParser(settings);
    }

    Quartet parseCogStats1(File file){
        List<String[]> allRows = parser.parseAll(file);
        return new Quartet<>(allRows.get(1)[1],allRows.get(2)[1], allRows.get(3)[1], allRows.get(4)[1]);
    }

    List<Pair> parseCogStats2(File file){
        List<Pair> result = new ArrayList<>();
        List<String[]> allRows = parser.parseAll(file);

        for (int i=1; i<= 25; i++){
            String name = allRows.get(i)[0] + "_cog2";
            Pair<String, String> tuple = Pair.with(name , allRows.get(i)[2]);
            result.add(tuple);
        }
        return result;
    }

    Sextet parseKeggStats1(File file){
        List<String[]> allRows = parser.parseAll(file);
        return new Sextet<>(
                allRows.get(1)[1],
                allRows.get(2)[1],
                allRows.get(3)[1],
                allRows.get(4)[1],
                allRows.get(5)[1],
                allRows.get(6)[1]
        );
    }

    List<Pair> parseKeggStats2(File file){
        List<Pair> result = new ArrayList<>();
        List<String[]> allRows = parser.parseAll(file);

        for (int i=1; i<= 37; i++){
            String name = modifyName(allRows.get(i)[0]);
            Pair<String, String> tuple = Pair.with(name , allRows.get(i)[1]);
            result.add(tuple);
        }

        return result;
    }

    List<SolrInputDocument> parseFuncTable(File file){
        parser.beginParsing(file);
        String[] row;
        List<SolrInputDocument> documentBatch = new ArrayList<>();

        parser.parseNext(); //skip the titles...
        while((row = parser.parseNext()) != null){
            SolrInputDocument orfDoc = parseFunctTableRow(row);
            documentBatch.add(orfDoc);

        }
        return documentBatch;
    }

    private SolrInputDocument parseFunctTableRow(String[] row){
        SolrInputDocument doc = new SolrInputDocument();
        doc.addField("ORFID", row[0]);
        doc.addField("ORF_len", row[1]);
        doc.addField("start", row[2]);
        doc.addField("end", row[3]);
        doc.addField("strand_sense", row[6]);
        doc.addField("taxonomy", row[8]);
        return doc;
    }


    List<SolrInputDocument> parseORFAnnotTable(File file){
        parser.beginParsing(file);
        String[] row;
        List<SolrInputDocument> documentBatch = new ArrayList<>();

        while((row = parser.parseNext()) != null){
            SolrInputDocument orfDoc = parseORFAnnotTableRow(row);
            documentBatch.add(orfDoc);
        }
        return documentBatch;
    }

    private SolrInputDocument parseORFAnnotTableRow(String[] row){
        SolrInputDocument doc = new SolrInputDocument();
        doc.addField("ORFID", row[0]);

        Map<String, String> cogID = new HashMap<>();
        cogID.put("set", row[2]);
        doc.addField("COGID", cogID);

        Map<String, String> keggID = new HashMap<>();
        keggID.put("set", row[3]);
        doc.addField("KEGGID", keggID);

        Map<String, String> product = new HashMap<>();
        product.put("set", row[4]);
        doc.addField("product", product);

        Map<String, String> extended = new HashMap<>();
        extended.put("set", row[6]);
        doc.addField("extended_desc", extended);
        return doc;
    }

    List<SolrInputDocument> parseRPKMTable(File file){
        parser.beginParsing(file);
        String[] row;
        List<SolrInputDocument> documentBatch = new ArrayList<>();
        while((row = parser.parseNext()) != null){
            SolrInputDocument rpkmDoc = new SolrInputDocument();
            if(row[0].equals("")){
                System.out.println("here");
            }

            rpkmDoc.addField("ORFID", row[0]);
            Map<String, String> rpkmValue = new HashMap<>();
            rpkmValue.put("set", row[1]);
            rpkmDoc.addField("rpkm", rpkmValue);
            documentBatch.add(rpkmDoc);
        }
        return documentBatch;
    }


    private static String modifyName(String title){
        StringBuilder result = new StringBuilder();

        int len = title.length();
        if(len < 25){ //parse the smaller titles first
            result = result.append(title.trim().replaceAll(" ", "_").toLowerCase()).append("_kegg2");
            return result.toString();
        }
        //specific cases
        if(len == 40){
            return "metabolism_terpenoids_kegg2";
        }
        if(len == 31){
            return "metabolism_other_kegg2";
        }
        if(len == 36){
            return "metabolism_cofactors_kegg2";
        }
        //others
        else{
            String[] words = title.split(" ");
            result = result.append(words[0].replaceAll(",","").toLowerCase()).append("_kegg2");
            return result.toString();
        }
    }


}