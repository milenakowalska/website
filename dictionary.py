from bs4 import BeautifulSoup  
import requests, os, datetime
from collections import namedtuple
from lxml import etree
from dataclasses import dataclass
import sys


languages = {'francais':['fr','fre'], 'polonais':['pl','pol'], 'italien':['it','ita'], 'allemand':['de','ger'], 'anglais':['en','eng'],'portugais':['pt','por'],'chinois':['zh','zho'], 'espagnol':['es','spa'], 'russe':['ru','rus'] }

def dictionary_template(dictionary, language_from, language_to):
        dictionary_name = f'{dictionary}_{language_from}_{language_to}.xdxf'
        
        root = etree.Element('xdxf')
        root.set('lang_from', languages[language_from][1])
        root.set('lang_to', languages[language_to][1])
        root.set('format', 'visual')
        root.set('revision', 'DD')

        meta_info = etree.SubElement(root, 'meta_info')
        title = etree.SubElement(meta_info, 'title')
        title.text = f'{dictionary.capitalize()}: {language_from} - {language_to}'

        description = etree.SubElement(meta_info, 'description')
        description.text = f'Dictionary: {dictionary.capitalize()}; language-from: {language_from}; language-to: {language_to}'        

        full_name = etree.SubElement(meta_info, 'full_name')
        full_name.text = f'{dictionary.capitalize()}: {language_from} - {language_to}'

        creation_date = etree.SubElement(meta_info, 'creation_date')
        creation_date.text = datetime.date.today().strftime("%d-%m-%Y")

        etree.SubElement(root, 'lexicon')
        tree = etree.ElementTree(root)
        tree.write(f'public/dictionaries/{dictionary_name}', pretty_print=True, xml_declaration=True, encoding='utf-8')

@dataclass
class Word:
    key: str
    translations: str
    context: str = None

@dataclass
class Example:
    example: str
    translation_example: str = None

class DictionaryParser:
    @staticmethod
    def find_definition(language_from, language_to, word):
        '''Finds word definitions on a Website'''
        raise Exception("NotImplementedException")

class WordreferenceParser(DictionaryParser):
    """Searches word definition in wordreference.com"""
    dictionary_string = 'wordreference'
    @staticmethod
    def find_definition(language_from, language_to, word):
        language_from = languages[language_from][0]
        language_to = languages[language_to][0]
        source = requests.get(f'https://www.wordreference.com/{language_from}{language_to}/{word}').text

        soup = BeautifulSoup(source, 'lxml').body
        list_of_words = []
        list_of_examples = []

        tables = soup.find_all("table", class_='WRD')
        current_class = ['odd']

        list_of_translations = []
        key = None
        example = None
        translation_example = None
        context = None

        for table in tables:
            next_position = table.find_all('tr')
            for tr in next_position:
                if tr['class'] == ['even'] or tr['class'] == ['odd']:
                    if tr['class'] != current_class:
                        if key:
                            next_word = Word(key=key, translations=', '.join(list_of_translations), context=context)
                            list_of_words.append(next_word)
                            list_of_translations = []
                            key = None
                            context = None

                        if example:
                            list_of_examples.append(Example(example, translation_example))
                            example = None
                            translation_example = None

                        current_class = tr['class']
                        key = tr.find('td', class_='FrWrd').strong.text

                        if (tr.find('td', class_=None)) is not None:
                            context = tr.find('td', class_=None).text
                            
                        if (translation := tr.find('td', class_='ToWrd')) is not None:
                            list_of_translations.append(translation.find(text=True,recursive=False))
                    
                    else:
                        if (translation := tr.find('td', class_='ToWrd')) is not None:
                            list_of_translations.append(translation.find(text=True,recursive=False))

                        if (tr.find('td', class_='FrEx')) is not None:
                            example = tr.find('td', class_='FrEx').text
                        
                        if (tr.find('td', class_='ToEx')) is not None:
                            translation_example = tr.find('td', class_='ToEx').text

        return [list_of_words, list_of_examples]

class DictionnaireParser(DictionaryParser):
    """Searches word definition in dictionnaire.reverso.net"""
    dictionary_string = 'dictionnaire'
    @staticmethod
    def find_definition(language_from, language_to, word):
        source = requests.get(f'https://dictionnaire.reverso.net/{language_from}-{language_to}/{word}', headers={'User-Agent': 'Mozilla/5.0'}).text

        soup = BeautifulSoup(source, 'lxml').body
        list_of_words = []
        list_of_examples = []
        
        for div in soup.find('form').find_all('tr', valign='top'):

            key = div.find('td', class_='CDResSource').find('span', class_='ellipsis_text').text
            translation = div.find('td', class_='CDResTarget').find('span', class_='ellipsis_text').text
            if word in translation:
                key, translation = translation, key
            list_of_words.append(Word(key, translation))

        if (examples := soup.find('table', class_='contextlist')) is not None:

            for tr in examples.find_all('tr'):
                if tr.find('td', class_='src') is not None:
                    translation = tr.find('td', class_='src').text
                    example = tr.find('td', class_='tgt').text
                    list_of_examples.append(Example(example, translation))
            for tr in examples.find_all('tr'):
                if tr.find('td', class_='transName') is not None:
                    key = word
                    translation = tr.find('span', id='translationName')
                    if 'notrans' in translation.get_attribute_list('class'):
                        break
                    else:
                        translation = translation.text
                    list_of_words.append(Word(key, translation))

        if (new := soup.find('div', class_='translate_box0')) is not None:

            if (translations := new.find_all('span', direction='targettarget')) is not None:
                for translation in translations:
                    if (context := translation.findNext('span')) is not None:
                        if "(" in context.text:
                            list_of_words.append(Word(word, translation.text, context.text))
                        elif "(" in context.findNext('span').text:
                            list_of_words.append(Word(word, translation.text, context.findNext('span').text))
                    else:
                        list_of_words.append(Word(word, translation.text))

            if (examples := new.find_all('span', direction='')) is not None:
                for example in examples:
                    if example is not None and len(example.text) > 0:
                        if str(example.text)[0] == '→':
                            list_of_examples.append(Example(example.text, ''))
            
        return [list_of_words, list_of_examples]

installed_dictionaries = [WordreferenceParser, DictionnaireParser]

def check_word(dictionary: str, language_from: str, language_to: str, word: str) -> list:
    current_dictionary = f'public/dictionaries/{dictionary}_{language_from}_{language_to}.xdxf'

    list_of_words, list_of_examples = [],[]
    if os.path.exists(current_dictionary):
        parser = etree.XMLParser(remove_blank_text=True)
        tree = etree.parse(current_dictionary, parser)
        root = tree.getroot()
        for element in tree.iter('ar'):
            if element.get('key') == word:
                key, translation, context, translation_example, example = '','','','',''
                for tag in element.iter():
                    if tag.tag == 'k':
                        key = tag.text
                    elif tag.tag == 'span':
                        translation = tag.text
                    elif tag.tag == 'context':
                        context = tag.text
                    elif tag.tag == 'trans':
                        translation_example = tag.text
                    elif tag.tag == 'ex':
                        example = tag.text
                    elif tag.tag == 'hr':
                        if key != '' and translation != '':
                            list_of_words.append(Word(key, translation, context))
                        if example != '':
                            list_of_examples.append(Example(example, translation_example))
                        key, translation, definition, example = '','','',''
    else:
        dictionary_template(dictionary, language_from, language_to)
        parser = etree.XMLParser(remove_blank_text=True)
        tree = etree.parse(current_dictionary, parser)
        root = tree.getroot()

    if list_of_words == [] and list_of_examples == []:  
        for dictionary_class_name in installed_dictionaries:
            if dictionary_class_name.dictionary_string == dictionary:
                dictionary_class = dictionary_class_name  
        list_of_words, list_of_examples = dictionary_class.find_definition(language_from, language_to, word)

        ar = etree.SubElement(root.find('lexicon'), 'ar')
        ar.set('key',word)

        for definition in list_of_words:
            key = etree.SubElement(ar, 'k')
            key.text = definition.key
            if definition.translations:
                defin = etree.SubElement(ar, 'span')
                defin.text = definition.translations
            if definition.context:
                context = etree.SubElement(ar, 'context')
                context.text = definition.context
            etree.SubElement(ar, 'hr')

        for example in list_of_examples:
            if example.example:
                ex = etree.SubElement(ar, 'ex')
                ex.text = example.example
            translation_example = etree.SubElement(ar, 'trans')
            translation_example.text = example.translation_example
            etree.SubElement(ar, 'hr')
            
        if list_of_words != [] and list_of_examples != []: 
            tree.write(current_dictionary, encoding='utf-8', pretty_print=True, xml_declaration=True)

    if list_of_words != [] and list_of_examples != []: 
        print ([list_of_words, list_of_examples])
    else:
        return [[Word('Word not found!', '')],[]]

check_word(sys.argv[-4], sys.argv[-3], sys.argv[-2], sys.argv[-1])
